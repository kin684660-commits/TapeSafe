// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title TapeSafeModule
/// @notice Holds a TapeOut circuit NFT and releases the ERC-6551 vault only when that
///         circuit's eval output bit is 1. CALL only — never delegatecall.
/// @dev Unaudited prototype. Safety is capped by the TapeOut admin keys: the factory,
///      circuit beacon, and container beacon are upgradeable and unaudited.
contract TapeSafeModule {
    enum Kind { Transfer, Config, SiteOp }

    struct Proposal {
        Kind kind;
        address to;
        uint256 value;
        bytes data;
        uint64 deadline;
        address proposer;
        uint8 proposerIndex;
        uint8 approvals;
        bool executed;
        bool cancelled;
        bool thaw;
        uint256 configNonce;
    }

    uint256 public constant MAX_SIGNERS = 5;
    uint256 public constant MAX_TTL = 30 days;
    uint256 public constant MAX_LIFE = 30 days;
    uint256 public constant MAX_FEE = 0.01 ether;
    bytes4 private constant RECEIVER = 0x150b7a02;

    address public immutable circuits;
    uint256 public immutable vaultId;
    uint256 public immutable ruleId;
    address public immutable container;
    address public immutable siteRegistry;

    address[] public signers;
    mapping(address => uint256) public signerId;
    uint8 public threshold;
    uint8 public mustMask;
    bool public frozen;
    uint256 public configNonce;
    uint256 public nextId = 1;
    mapping(uint256 => Proposal) private _proposals;
    uint256 private locked;

    error NotSigner();
    error NoProposal();
    error Closed();
    error Expired();
    error Stale();
    error HashMismatch(bytes32 claimed, bytes32 actual);
    error PolicyRejected(bytes inputs, bytes outputs);
    error ForbiddenTarget();
    error BadFee(uint256 sent, uint256 need);
    error NotCustody();
    error BadConfig();
    error Reentered();
    error BadParam();
    error CallFailed();

    event Proposed(uint256 indexed id, address indexed proposer, Kind kind, address to, uint256 value, bytes32 dataHash, bytes32 proposalHash, uint64 deadline);
    event Approved(uint256 indexed id, address indexed signer, uint8 index, bytes32 proposalHash);
    event Revoked(uint256 indexed id, address indexed signer);
    event Cancelled(uint256 indexed id, address indexed by);
    event Executed(uint256 indexed id, bytes inputs, bytes outputs, bytes32 proposalHash);
    event Frozen(address indexed by);
    event ConfigChanged(uint256 configNonce);
    event SignerReplaced(uint256 configNonce);

    constructor(
        address circuits_,
        uint256 vaultId_,
        uint256 ruleId_,
        address container_,
        address site_,
        address[] memory signers_,
        uint8 threshold_,
        uint8 must_
    ) {
        if (circuits_ == address(0) || container_ == address(0) || site_ == address(0) || vaultId_ == 0 || ruleId_ == 0) revert BadParam();
        circuits = circuits_;
        vaultId = vaultId_;
        ruleId = ruleId_;
        container = container_;
        siteRegistry = site_;
        _setSigners(signers_, threshold_, must_);
    }

    function signerCount() external view returns (uint256) { return signers.length; }

    function custodyOk() public view returns (bool) {
        (bool okNft, bytes memory nft) = circuits.staticcall(abi.encodeWithSignature("ownerOf(uint256)", vaultId));
        if (!okNft || nft.length < 32 || abi.decode(nft, (address)) != address(this)) return false;
        (bool okOwner, bytes memory who) = container.staticcall(abi.encodeWithSignature("owner()"));
        return okOwner && who.length >= 32 && abi.decode(who, (address)) == address(this);
    }

    function proposalInfo(uint256 id) external view returns (
        Kind kind, address to, uint256 value, bytes memory data, uint64 deadline,
        address proposer, uint8 approvals, bool executed, bool cancelled, bool thaw, uint256 nonce
    ) {
        Proposal storage p = _proposals[id];
        return (p.kind, p.to, p.value, p.data, p.deadline, p.proposer, p.approvals, p.executed, p.cancelled, p.thaw, p.configNonce);
    }

    function hashOf(uint256 id) public view returns (bytes32) {
        Proposal storage p = _proposals[id];
        if (p.proposer == address(0)) revert NoProposal();
        return _hash(id, p.kind, p.to, p.value, p.data, p.configNonce, p.deadline);
    }

    function previewHash(Kind kind, address to, uint256 value, bytes calldata data, uint64 deadline) external view returns (bytes32) {
        return _hash(nextId, kind, to, value, data, configNonce, deadline);
    }

    function inputsFor(uint256 id) public view returns (bytes memory) {
        Proposal storage p = _proposals[id];
        if (p.proposer == address(0)) revert NoProposal();
        uint256 bits = uint256(p.approvals)
            | (uint256(1) << (5 + p.proposerIndex))
            | (uint256(mustMask) << 10)
            | (uint256(threshold) << 15)
            | ((frozen && !p.thaw) ? (uint256(1) << 18) : 0);
        bytes memory out = new bytes(3);
        out[0] = bytes1(uint8(bits));
        out[1] = bytes1(uint8(bits >> 8));
        out[2] = bytes1(uint8(bits >> 16));
        return out;
    }

    function check(uint256 id) external view returns (bytes memory inputs, bytes memory outputs, bool ok) {
        inputs = inputsFor(id);
        outputs = _eval(inputs);
        ok = outputs.length > 0 && (uint8(outputs[0]) & 1) == 1;
    }

    function propose(Kind kind, address to, uint256 value, bytes calldata data, uint64 deadline) external returns (uint256 id) {
        uint256 index = _signerIndex(msg.sender);
        if (deadline <= block.timestamp || deadline > block.timestamp + MAX_LIFE) revert BadParam();
        if (data.length > 4096) revert BadParam();
        bool thaw = false;
        if (kind == Kind.Transfer) {
            if (to == address(0) || _forbidden(to)) revert ForbiddenTarget();
        } else if (kind == Kind.Config) {
            if (to != address(this) || value != 0 || data.length < 4) revert BadConfig();
            bytes4 sel = bytes4(data[:4]);
            if (sel == this.applyUnfreeze.selector) {
                if (!frozen || data.length != 4) revert BadConfig();
                thaw = true;
            }
            else if (sel != this.applySigners.selector) revert BadConfig();
        } else if (kind == Kind.SiteOp) {
            if (to == address(0) || to == address(this) || value == 0 || value > MAX_TTL || data.length != 0) revert BadParam();
        } else {
            revert BadParam();
        }
        id = nextId++;
        Proposal storage p = _proposals[id];
        p.kind = kind;
        p.to = to;
        p.value = value;
        p.data = data;
        p.deadline = deadline;
        p.proposer = msg.sender;
        p.proposerIndex = uint8(index);
        p.thaw = thaw;
        p.configNonce = configNonce;
        emit Proposed(id, msg.sender, kind, to, value, keccak256(data), _hash(id, kind, to, value, data, configNonce, deadline), deadline);
    }

    function approve(uint256 id, bytes32 expectedHash) external {
        uint256 index = _signerIndex(msg.sender);
        Proposal storage p = _live(id);
        bytes32 actual = hashOf(id);
        if (actual != expectedHash) revert HashMismatch(expectedHash, actual);
        p.approvals |= uint8(1 << index);
        emit Approved(id, msg.sender, uint8(index), actual);
    }

    function revoke(uint256 id) external {
        uint256 index = _signerIndex(msg.sender);
        Proposal storage p = _live(id);
        p.approvals &= ~uint8(1 << index);
        emit Revoked(id, msg.sender);
    }

    function cancel(uint256 id) external {
        Proposal storage p = _proposals[id];
        if (p.proposer == address(0)) revert NoProposal();
        if (msg.sender != p.proposer) revert NotSigner();
        if (p.executed || p.cancelled) revert Closed();
        p.cancelled = true;
        emit Cancelled(id, msg.sender);
    }

    function freeze() external {
        _signerIndex(msg.sender);
        if (frozen) revert Closed();
        frozen = true;
        configNonce++; // Invalidate approvals prepared before this emergency.
        emit ConfigChanged(configNonce);
        emit Frozen(msg.sender);
    }

    function execute(uint256 id) external payable {
        if (locked != 0) revert Reentered();
        locked = 1;
        _signerIndex(msg.sender);
        Proposal storage p = _live(id);
        if (!custodyOk()) revert NotCustody();
        bytes memory inputs = inputsFor(id);
        bytes memory outputs = _eval(inputs);
        if (outputs.length == 0 || (uint8(outputs[0]) & 1) != 1) revert PolicyRejected(inputs, outputs);
        p.executed = true;
        emit Executed(id, inputs, outputs, hashOf(id));
        if (p.kind == Kind.Transfer) {
            uint256 fee = _execFee();
            if (msg.value != fee) revert BadFee(msg.value, fee);
            (bool ok, bytes memory ret) = container.call{value: fee}(
                abi.encodeWithSignature("execute(address,uint256,bytes,uint8)", p.to, p.value, p.data, uint8(0))
            );
            if (!ok) _bubble(ret);
        } else if (p.kind == Kind.Config) {
            if (msg.value != 0) revert BadFee(msg.value, 0);
            (bool ok, bytes memory ret) = address(this).call(p.data);
            if (!ok) _bubble(ret);
        } else {
            if (msg.value != 0) revert BadFee(msg.value, 0);
            (bool ok, bytes memory ret) = siteRegistry.call(
                abi.encodeWithSignature("setOperator(address,address,uint256)", container, p.to, p.value)
            );
            if (!ok) _bubble(ret);
        }
        locked = 0;
    }

    /// @notice Config proposal body. The circuit is evaluated with the freeze bit forced off.
    function applyUnfreeze() external {
        if (msg.sender != address(this)) revert NotSigner();
        frozen = false;
        configNonce++;
        emit ConfigChanged(configNonce);
    }

    /// @notice Config proposal body. Rejected by the circuit while the vault is frozen.
    function applySigners(address[] calldata next, uint8 newThreshold, uint8 newMust) external {
        if (msg.sender != address(this)) revert NotSigner();
        if (frozen) revert Closed();
        _setSigners(next, newThreshold, newMust);
        configNonce++;
        emit ConfigChanged(configNonce);
        emit SignerReplaced(configNonce);
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external view returns (bytes4) {
        if (msg.sender != circuits || tokenId != vaultId) revert BadParam();
        return RECEIVER;
    }

    function _setSigners(address[] memory next, uint8 newThreshold, uint8 newMust) internal {
        uint256 n = next.length;
        if (n == 0 || n > MAX_SIGNERS || newThreshold == 0 || newThreshold >= n) revert BadParam();
        if (uint256(newMust) >> n != 0 || uint256(newMust) == (1 << n) - 1) revert BadParam();
        for (uint256 i = 0; i < signers.length; i++) signerId[signers[i]] = 0;
        delete signers;
        for (uint256 i = 0; i < n; i++) {
            if (next[i] == address(0) || signerId[next[i]] != 0) revert BadParam();
            signerId[next[i]] = i + 1;
            signers.push(next[i]);
        }
        threshold = newThreshold;
        mustMask = newMust;
    }

    function _live(uint256 id) internal view returns (Proposal storage p) {
        p = _proposals[id];
        if (p.proposer == address(0)) revert NoProposal();
        if (p.executed || p.cancelled) revert Closed();
        if (block.timestamp > p.deadline) revert Expired();
        if (p.configNonce != configNonce) revert Stale();
    }

    function _signerIndex(address account) internal view returns (uint256) {
        uint256 id = signerId[account];
        if (id == 0) revert NotSigner();
        return id - 1;
    }

    function _forbidden(address to) internal view returns (bool) {
        return to == address(this) || to == container || to == circuits || to == siteRegistry;
    }

    function _eval(bytes memory inputs) internal view returns (bytes memory) {
        (bool ok, bytes memory ret) = circuits.staticcall(abi.encodeWithSignature("eval(uint256,bytes)", ruleId, inputs));
        if (!ok) _bubble(ret);
        return abi.decode(ret, (bytes));
    }

    function _execFee() internal view returns (uint256 fee) {
        (bool ok, bytes memory ret) = container.staticcall(abi.encodeWithSignature("EXEC_FEE()"));
        if (!ok || ret.length < 32) revert CallFailed();
        fee = abi.decode(ret, (uint256));
        if (fee > MAX_FEE) revert BadFee(fee, MAX_FEE);
    }

    function _hash(uint256 id, Kind kind, address to, uint256 value, bytes memory data, uint256 nonce, uint64 deadline) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), id, kind, to, value, keccak256(data), nonce, deadline));
    }

    function _bubble(bytes memory ret) internal pure {
        if (ret.length == 0) revert CallFailed();
        assembly { revert(add(ret, 32), mload(ret)) }
    }
}
