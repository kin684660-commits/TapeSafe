// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {TapeSafeModule} from "../src/TapeSafeModule.sol";

contract MockCircuits {
    address public holder = address(1);

    function setHolder(address next) external { holder = next; }

    function ownerOf(uint256) external view returns (address) { return holder; }

    function eval(uint256, bytes calldata inputs) external pure returns (bytes memory) {
        uint256 bits = uint8(inputs[0]) | (uint256(uint8(inputs[1])) << 8) | (uint256(uint8(inputs[2])) << 16);
        uint256 eff = (bits & 31) & ~((bits >> 5) & 31);
        uint256 cnt;
        for (uint256 i = 0; i < 5; i++) if ((eff >> i) & 1 == 1) cnt++;
        uint256 must = (bits >> 10) & 31;
        uint256 m = (bits >> 15) & 7;
        bool pass = ((bits >> 18) & 1) == 0 && m != 0 && cnt >= m && (eff & must) == must;
        bytes memory out = new bytes(1);
        out[0] = pass ? bytes1(0x01) : bytes1(0x00);
        return out;
    }
}

contract MockAccount {
    address public owner;
    uint256 public constant EXEC_FEE = 0.0013 ether;
    uint256 public calls;
    address public lastTo;
    uint256 public lastValue;
    uint8 public lastOp;

    function setOwner(address next) external { owner = next; }

    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory) {
        require(msg.sender == owner, "owner");
        require(operation == 0, "op");
        require(msg.value == EXEC_FEE, "fee");
        calls++;
        lastTo = to;
        lastValue = value;
        lastOp = operation;
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        require(ok, "inner");
        return ret;
    }
}

contract MockSite {
    address public lastOp;
    uint256 public lastTtl;
    address public lastContainer;
    function setOperator(address container, address op, uint256 ttl) external {
        lastContainer = container;
        lastOp = op;
        lastTtl = ttl;
    }
}

contract TapeSafeUnitTest is Test {
    MockCircuits circuits;
    MockAccount account;
    MockSite site;
    TapeSafeModule module;
    address a = makeAddr("a");
    address b = makeAddr("b");
    address c = makeAddr("c");
    address bob = makeAddr("bob");

    function setUp() public {
        circuits = new MockCircuits();
        account = new MockAccount();
        site = new MockSite();
        address[] memory signers = new address[](3);
        signers[0] = a; signers[1] = b; signers[2] = c;
        module = new TapeSafeModule(address(circuits), 1, 1, address(account), address(site), signers, 2, 0);
        circuits.setHolder(address(module));
        account.setOwner(address(module));
        vm.deal(address(account), 1 ether);
        vm.deal(a, 1 ether);
        vm.deal(b, 1 ether);
        vm.deal(c, 1 ether);
    }

    function test_known_vector_and_freeze_bit() public {
        uint256 id = _proposeTransfer(a, bob, 0.1 ether);
        _approve(b, id);
        _approve(c, id);
        assertEq(module.inputsFor(id), hex"260001");
        vm.prank(a);
        module.freeze();
        assertEq(uint8(module.inputsFor(id)[2]) & 0x04, 0x04);
    }

    function test_one_vote_rejects_two_votes_pay() public {
        uint256 id = _proposeTransfer(a, bob, 0.1 ether);
        _approve(b, id);
        vm.prank(b);
        vm.expectRevert();
        module.execute{value: 0.0013 ether}(id);
        _approve(c, id);
        uint256 before = bob.balance;
        vm.prank(c);
        module.execute{value: 0.0013 ether}(id);
        assertEq(bob.balance - before, 0.1 ether);
        assertEq(account.calls(), 1);
        assertEq(account.lastOp(), 0);
        vm.prank(c);
        vm.expectRevert(TapeSafeModule.Closed.selector);
        module.execute{value: 0.0013 ether}(id);
    }

    function test_proposer_vote_does_not_count() public {
        uint256 id = _proposeTransfer(a, bob, 0.1 ether);
        _approve(a, id);
        vm.prank(a);
        vm.expectRevert();
        module.execute{value: 0.0013 ether}(id);
        _approve(b, id);
        vm.prank(b);
        vm.expectRevert();
        module.execute{value: 0.0013 ether}(id);
    }

    function test_hash_mismatch_reverts() public {
        uint256 id = _proposeTransfer(a, bob, 0.1 ether);
        vm.prank(b);
        vm.expectRevert();
        module.approve(id, bytes32(uint256(1)));
    }

    function test_forbidden_target_and_stranger() public {
        vm.prank(a);
        vm.expectRevert(TapeSafeModule.ForbiddenTarget.selector);
        module.propose(TapeSafeModule.Kind.Transfer, address(module), 0, "", uint64(block.timestamp + 1 days));
        vm.prank(bob);
        vm.expectRevert(TapeSafeModule.NotSigner.selector);
        module.propose(TapeSafeModule.Kind.Transfer, bob, 0, "", uint64(block.timestamp + 1 days));
    }

    function test_direct_container_call_blocked() public {
        vm.prank(a);
        vm.expectRevert(bytes("owner"));
        account.execute{value: 0.0013 ether}(bob, 0.1 ether, "", 0);
        vm.expectRevert(bytes("owner"));
        account.execute{value: 0.0013 ether}(bob, 0.1 ether, "", 0);
    }

    function test_freeze_and_unfreeze_kills_old_proposal() public {
        uint256 oldId = _proposeTransfer(a, bob, 0.1 ether);
        _approve(b, oldId);
        _approve(c, oldId);
        vm.prank(b);
        module.freeze();
        vm.prank(c);
        vm.expectRevert();
        module.execute{value: 0.0013 ether}(oldId);

        bytes memory data = abi.encodeWithSelector(module.applyUnfreeze.selector);
        vm.prank(a);
        uint256 thawId = module.propose(TapeSafeModule.Kind.Config, address(module), 0, data, uint64(block.timestamp + 1 days));
        assertEq(uint8(module.inputsFor(thawId)[2]) & 0x04, 0);
        _approve(b, thawId);
        _approve(c, thawId);
        vm.prank(b);
        module.execute(thawId);
        assertFalse(module.frozen());

        vm.prank(c);
        vm.expectRevert(TapeSafeModule.Stale.selector);
        module.execute{value: 0.0013 ether}(oldId);
    }

    function test_site_operator_needs_two_votes() public {
        vm.prank(a);
        uint256 id = module.propose(TapeSafeModule.Kind.SiteOp, bob, 1 hours, "", uint64(block.timestamp + 1 days));
        _approve(b, id);
        vm.prank(b);
        vm.expectRevert();
        module.execute(id);
        _approve(c, id);
        vm.prank(c);
        module.execute(id);
        assertEq(site.lastOp(), bob);
        assertEq(site.lastTtl(), 1 hours);
        assertEq(site.lastContainer(), address(account));
    }

    function test_delegatecall_is_not_an_operation_we_expose() public {
        uint256 id = _proposeTransfer(a, bob, 0);
        _approve(b, id);
        _approve(c, id);
        vm.prank(b);
        module.execute{value: 0.0013 ether}(id);
        assertEq(account.lastOp(), 0);
    }

    function test_rejects_deadlocked_configuration() public {
        address[] memory people = new address[](3);
        people[0] = a; people[1] = b; people[2] = c;
        vm.expectRevert(TapeSafeModule.BadParam.selector);
        new TapeSafeModule(address(circuits), 1, 1, address(account), address(site), people, 3, 0);
        vm.expectRevert(TapeSafeModule.BadParam.selector);
        new TapeSafeModule(address(circuits), 1, 1, address(account), address(site), people, 2, 7);
        // A minimum threshold does NOT limit the number of mandatory signers.
        new TapeSafeModule(address(circuits), 1, 1, address(account), address(site), people, 1, 6);
    }

    function test_freeze_invalidates_preexisting_approvals() public {
        uint256 id = _proposeTransfer(a, bob, 0);
        _approve(b, id); _approve(c, id);
        vm.prank(a); module.freeze();
        vm.prank(b); vm.expectRevert(TapeSafeModule.Stale.selector);
        module.execute{value: 0.0013 ether}(id);
    }

    function test_cannot_prepare_unfreeze_before_emergency() public {
        vm.prank(a); vm.expectRevert(TapeSafeModule.BadConfig.selector);
        module.propose(TapeSafeModule.Kind.Config, address(module), 0,
            abi.encodeWithSelector(module.applyUnfreeze.selector), uint64(block.timestamp + 1 days));
    }

    function test_revoke_cancel_and_expiry() public {
        uint256 id = _proposeTransfer(a, bob, 0);
        _approve(b, id); _approve(c, id);
        vm.prank(c); module.revoke(id);
        (,,bool ok) = module.check(id); assertFalse(ok);
        vm.prank(a); module.cancel(id);
        vm.prank(b); vm.expectRevert(TapeSafeModule.Closed.selector); module.approve(id, bytes32(0));
        id = _proposeTransfer(a, bob, 0);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(b); vm.expectRevert(TapeSafeModule.Expired.selector); module.execute(id);
    }

    function test_signer_rotation_invalidates_old_proposals() public {
        uint256 oldId = _proposeTransfer(a, bob, 0);
        address[] memory people = new address[](3);
        people[0] = a; people[1] = b; people[2] = bob;
        vm.prank(a);
        uint256 id = module.propose(TapeSafeModule.Kind.Config, address(module), 0,
            abi.encodeWithSelector(module.applySigners.selector, people, uint8(2), uint8(0)), uint64(block.timestamp + 1 days));
        _approve(b,id); _approve(c,id);
        vm.prank(b); module.execute(id);
        assertEq(module.signerId(c),0); assertEq(module.signerId(bob),3);
        vm.prank(b); vm.expectRevert(TapeSafeModule.Stale.selector); module.execute(oldId);
    }

    function test_wrong_fee_reverts_without_consuming_proposal() public {
        uint256 id = _proposeTransfer(a,bob,0);
        _approve(b,id); _approve(c,id);
        vm.prank(b); vm.expectPartialRevert(TapeSafeModule.BadFee.selector); module.execute(id);
        vm.prank(b); module.execute{value: 0.0013 ether}(id);
        assertEq(account.calls(),1);
    }

    function _proposeTransfer(address signer, address to, uint256 value) internal returns (uint256 id) {
        vm.prank(signer);
        id = module.propose(TapeSafeModule.Kind.Transfer, to, value, "", uint64(block.timestamp + 1 days));
    }

    function _approve(address signer, uint256 id) internal {
        bytes32 hash = module.hashOf(id);
        vm.prank(signer);
        module.approve(id, hash);
    }
}
