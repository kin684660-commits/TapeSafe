// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {TapeSafeModule} from "../src/TapeSafeModule.sol";

interface IFactory {
    function createCPU(string calldata name, string calldata symbol, string calldata story, uint256 supply, uint256 mintPrice) external payable returns (address transistors, address circuits);
    function deployFee() external view returns (uint256);
    function cpuCount() external view returns (uint256);
    function cpuAt(uint256 i) external view returns (address);
}

interface ITransistors {
    function mint(uint256 id, uint256 amount) external payable;
    function mintPrice() external view returns (uint256);
    function protocolFee() external view returns (uint256);
}

interface ICircuits {
    function tapeout(bytes calldata nl, uint32 nIn, uint32 nOut) external payable returns (uint256);
    function TAPEOUT_FEE() external view returns (uint256);
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
    function circuitInfo(uint256 id) external view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount);
    function safeTransferFrom(address from, address to, uint256 id) external;
    function ownerOf(uint256 id) external view returns (address);
}

interface IOpener {
    function open(address circuits, uint256 tokenId) external payable returns (address);
    function FEE() external view returns (uint256);
}

interface IAccount {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory);
    function owner() external view returns (address);
    function EXEC_FEE() external view returns (uint256);
}

interface ISite {
    function putFile(address container, string calldata path, string calldata contentType, bytes32 sha256Hash, bytes calldata data) external;
    function fileInfo(address container, string calldata path) external view returns (uint32 size, string memory contentType, bytes32 sha256Hash, uint40 updatedAt, uint256 chunkCount);
}

interface IBind {
    function bind(string calldata name, address container, uint256 months) external payable;
    function monthlyFee() external view returns (uint256);
}

contract TapeSafeForkTest is Test {
    address constant FACTORY = 0x1f09DAeFA827f02CBb40967cc91b259763760761;
    address constant OPENER = 0x536adD8F30f03b69f6fbF29d425A816A0dC50106;
    address constant SITE = 0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6;
    address constant BINDING = 0x68809Fd2fb343aA57D0aeB7f33Defe477c9666f9;

    ICircuits circuits;
    IAccount vault;
    TapeSafeModule module;
    uint256 policyId;
    uint256 majId;
    address a;
    address b;
    address c;
    address bob;

    function test_zero_price_processor_can_mint_and_tapeout() public {
        (address tokens, address chips) = IFactory(FACTORY).createCPU{value: IFactory(FACTORY).deployFee()}(
            "TapeSafe", "TSAFE", "Supply 210000; unit price 0; unaudited circuit prototype", 210000, 0
        );
        assertEq(ITransistors(tokens).mintPrice(), 0);
        ITransistors(tokens).mint{value: ITransistors(tokens).protocolFee()}(0, 74);
        uint256 id = ICircuits(chips).tapeout{value: ICircuits(chips).TAPEOUT_FEE()}(_nl("testdata/tapesafe_policy.hex"), 19, 1);
        assertEq(ICircuits(chips).eval(id, hex"260001"), hex"01");
        assertEq(ICircuits(chips).eval(id, hex"260005"), hex"00");
        assertEq(ICircuits(chips).ownerOf(id), address(this));
    }

    function test_agreed_price_processor_can_mint_and_tapeout() public {
        uint256 createFee = IFactory(FACTORY).deployFee();
        (address tokens, address chips) = IFactory(FACTORY).createCPU{value: createFee}(
            "TapeSafe", "TSAFE", "Supply 210000; unit price 0.000066 OKB; unaudited circuit prototype", 210000, 0.000066 ether
        );
        uint256 mintPrice = ITransistors(tokens).mintPrice();
        uint256 mintFee = ITransistors(tokens).protocolFee();
        uint256 tapeFee = ICircuits(chips).TAPEOUT_FEE();
        assertEq(mintPrice, 0.000066 ether);
        ITransistors(tokens).mint{value: mintPrice * 74 + mintFee}(0, 74);
        uint256 id = ICircuits(chips).tapeout{value: tapeFee}(_nl("testdata/tapesafe_policy.hex"), 19, 1);
        assertEq(ICircuits(chips).eval(id, hex"260001"), hex"01");
        assertEq(ICircuits(chips).eval(id, hex"260005"), hex"00");
        console.log("create fee wei", createFee);
        console.log("mint protocol fee wei", mintFee);
        console.log("tapeout fee wei", tapeFee);
        console.log("total excluding gas wei", createFee + mintPrice * 74 + mintFee + tapeFee);
    }

    function setUp() public {
        if (block.chainid != 196) {
            vm.skip(true);
            return;
        }
        vm.deal(address(this), 10 ether);
        a = makeAddr("a");
        b = makeAddr("b");
        c = makeAddr("c");
        bob = makeAddr("bob");
        vm.deal(a, 1 ether);
        vm.deal(b, 1 ether);
        vm.deal(c, 1 ether);

        uint256 fee = IFactory(FACTORY).deployFee();
        (address transistorsAddr, address created) = IFactory(FACTORY).createCPU{value: fee}(
            "TapeSafe",
            "TSAFE",
            unicode"每个 NAND 都是一次签批。TapeSafe 把多签规则烧进电路、把审批页刻上链。供应 210000｜单价 0.0003 OKB｜无预留｜未审计原型",
            210_000,
            0.0003 ether
        );
        circuits = ICircuits(created);
        ITransistors transistors = ITransistors(transistorsAddr);

        uint256 price = transistors.mintPrice();
        uint256 protocol = transistors.protocolFee();
        transistors.mint{value: price * 82 + protocol}(0, 82);

        uint256 tapeFee = circuits.TAPEOUT_FEE();
        policyId = circuits.tapeout{value: tapeFee}(_nl("testdata/tapesafe_policy.hex"), 19, 1);
        majId = circuits.tapeout{value: tapeFee}(_nl("testdata/maj3.hex"), 3, 1);

        address account = IOpener(OPENER).open{value: IOpener(OPENER).FEE()}(address(circuits), policyId);
        vault = IAccount(account);
        address[] memory signers = new address[](3);
        signers[0] = a; signers[1] = b; signers[2] = c;
        module = new TapeSafeModule(address(circuits), policyId, policyId, account, SITE, signers, 2, 0);
        console.log("policy", policyId);
        console.log("maj3", majId);
        console.log("vault", account);
        console.log("module", address(module));
    }

    function test_maj3_truth_table() public view {
        for (uint256 i = 0; i < 8; i++) {
            bytes memory inputs = new bytes(1);
            inputs[0] = bytes1(uint8(i));
            bytes memory out = circuits.eval(majId, inputs);
            bool aBit = i & 1 == 1;
            bool bBit = i & 2 == 2;
            bool cBit = i & 4 == 4;
            bool want = (aBit && cBit) || (bBit && (aBit || cBit));
            assertEq(uint8(out[0]) & 1, want ? 1 : 0);
        }
    }

    function test_policy_vectors() public view {
        (uint32 nIn, uint32 nOut, uint32 nState, uint32 gates) = circuits.circuitInfo(policyId);
        assertEq(nIn, 19);
        assertEq(nOut, 1);
        assertEq(nState, 0);
        assertEq(gates, 74);
        assertEq(circuits.eval(policyId, hex"260001"), hex"01");
        assertEq(circuits.eval(policyId, hex"210001"), hex"00");
        assertEq(circuits.eval(policyId, hex"260005"), hex"00");
        assertEq(circuits.eval(policyId, hex"260401"), hex"00");
    }

    function test_custody_and_transfer_flow() public {
        assertFalse(module.custodyOk());
        circuits.safeTransferFrom(address(this), address(module), policyId);
        assertTrue(module.custodyOk());
        assertEq(vault.owner(), address(module));
        vm.deal(address(vault), 1 ether);

        uint64 deadline = uint64(block.timestamp + 1 days);
        vm.prank(a);
        uint256 id = module.propose(TapeSafeModule.Kind.Transfer, bob, 0.1 ether, "", deadline);
        bytes32 hash = module.hashOf(id);
        vm.expectRevert(abi.encodeWithSelector(TapeSafeModule.HashMismatch.selector, bytes32(uint256(1)), hash));
        vm.prank(b);
        module.approve(id, bytes32(uint256(1)));
        vm.prank(b);
        module.approve(id, hash);
        uint256 fee = vault.EXEC_FEE();
        vm.expectPartialRevert(TapeSafeModule.PolicyRejected.selector);
        vm.prank(b);
        module.execute{value: fee}(id);

        bytes32 hashC = module.hashOf(id);
        vm.prank(c);
        module.approve(id, hashC);
        uint256 before = bob.balance;
        vm.prank(c);
        module.execute{value: fee}(id);
        assertEq(bob.balance - before, 0.1 ether);

        vm.expectRevert(TapeSafeModule.Closed.selector);
        vm.prank(c);
        module.execute{value: fee}(id);
    }

    function test_direct_container_call_blocked() public {
        circuits.safeTransferFrom(address(this), address(module), policyId);
        vm.deal(address(vault), 1 ether);
        uint256 fee = vault.EXEC_FEE();
        vm.prank(a);
        vm.expectRevert();
        vault.execute{value: fee}(bob, 0.1 ether, "", 0);
        vm.expectRevert();
        vault.execute{value: fee}(bob, 0.1 ether, "", 0);
    }

    function test_freeze_and_unfreeze() public {
        circuits.safeTransferFrom(address(this), address(module), policyId);
        vm.deal(address(vault), 1 ether);
        uint64 deadline = uint64(block.timestamp + 1 days);
        vm.prank(a);
        uint256 oldId = module.propose(TapeSafeModule.Kind.Transfer, bob, 0.05 ether, "", deadline);
        _approve(b, oldId);
        _approve(c, oldId);
        vm.prank(a);
        module.freeze();
        uint256 fee = vault.EXEC_FEE();
        assertEq(module.inputsFor(oldId), hex"260005");
        (,,bool allowed) = module.check(oldId);
        assertFalse(allowed);
        vm.expectRevert(TapeSafeModule.Stale.selector);
        vm.prank(b);
        module.execute{value: fee}(oldId);

        bytes memory data = abi.encodeWithSelector(module.applyUnfreeze.selector);
        vm.prank(a);
        uint256 thawId = module.propose(TapeSafeModule.Kind.Config, address(module), 0, data, deadline);
        _approve(b, thawId);
        _approve(c, thawId);
        vm.prank(b);
        module.execute(thawId);
        assertFalse(module.frozen());
        vm.expectRevert(TapeSafeModule.Stale.selector);
        vm.prank(c);
        module.execute{value: fee}(oldId);
    }

    function test_site_operator_via_multisig() public {
        uint256 index = IFactory(FACTORY).cpuCount() - 1;
        assertEq(IFactory(FACTORY).cpuAt(index), address(circuits));
        string memory name = string.concat("1.2.", vm.toString(index), ".tape");
        IBind(BINDING).bind{value: IBind(BINDING).monthlyFee() * 3}(name, address(vault), 3);

        circuits.safeTransferFrom(address(this), address(module), policyId);
        uint64 deadline = uint64(block.timestamp + 1 days);
        vm.prank(a);
        uint256 id = module.propose(TapeSafeModule.Kind.SiteOp, bob, 1 hours, "", deadline);
        _approve(b, id);
        _approve(c, id);
        vm.prank(c);
        module.execute(id);

        bytes memory body = "hello tapesafe";
        bytes32 bodyHash = sha256(body);
        vm.expectRevert();
        vm.prank(a);
        ISite(SITE).putFile(address(vault), "index.html", "text/html", bodyHash, body);
        vm.prank(bob);
        ISite(SITE).putFile(address(vault), "index.html", "text/html", bodyHash, body);
        (uint32 size,, bytes32 hash,,) = ISite(SITE).fileInfo(address(vault), "index.html");
        assertEq(size, body.length);
        assertEq(hash, sha256(body));

        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert();
        vm.prank(bob);
        ISite(SITE).putFile(address(vault), "index.html", "text/html", bodyHash, body);
    }

    function test_self_approval_ignored_on_chain() public {
        circuits.safeTransferFrom(address(this), address(module), policyId);
        vm.deal(address(vault), 1 ether);
        vm.prank(a);
        uint256 id = module.propose(TapeSafeModule.Kind.Transfer, bob, 0.01 ether, "", uint64(block.timestamp + 1 days));
        _approve(a, id);
        _approve(b, id);
        uint256 fee = vault.EXEC_FEE();
        vm.expectPartialRevert(TapeSafeModule.PolicyRejected.selector);
        vm.prank(b);
        module.execute{value: fee}(id);
    }

    function _approve(address signer, uint256 id) internal {
        bytes32 hash = module.hashOf(id);
        vm.prank(signer);
        module.approve(id, hash);
    }

    function _nl(string memory path) internal view returns (bytes memory) {
        return vm.parseBytes(vm.readFile(path));
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return 0xf23a6e61;
    }
}
