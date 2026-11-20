// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title OneDraw
/// @notice Sybil-resistant draw (raffle / allowlist lottery) for Binance Agent ID holders.
///
/// @dev Core idea: an Agent ID is one-per-KYC and non-transferable, so the address
/// that holds it is permanently bound to one verified human. Combined with
/// "one entry per address", that makes one-entry-per-human enforceable on-chain —
/// something wallet-based raffles can never do.
///
/// Properties:
/// - No owner, no admin, no upgrade, no withdraw function.
/// - Never holds user funds. Entry is free (value must be 0).
/// - Randomness comes from a future block hash fixed at creation time, so neither
///   the sponsor nor the settler can steer the result.
/// - Degraded mode (settleLate) exists only if the keeper misses the 256-block
///   window; it emits a distinct event so every settlement is auditable.
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract OneDraw {
    struct Draw {
        address sponsor;
        address nft;        // address(0) = no on-chain prize (honour / off-chain fulfilment)
        uint256 tokenId;
        uint32 closeBlock;  // last block that accepts entries
        uint32 settleBlock; // block whose hash decides the result
        uint16 winners;     // number of winning slots
        uint16 entries;     // number of participants
        bool settled;
        bool prizeOut;      // escrowed NFT has left the contract
    }

    uint32 public constant SETTLE_DELAY = 1;      // closeBlock + 1: hash unknown while entering
    uint32 public constant SETTLE_WINDOW = 255;   // blockhash is readable for 256 blocks
    uint16 public constant MAX_WINNERS = 100;
    uint32 public constant RECLAIM_DELAY = 2_000;  // blocks before an unclaimed prize can go back
    uint32 public constant MIN_DURATION = 20;     // blocks
    uint32 public constant MAX_DURATION = 2_000_000;

    IAgentID public immutable agentId;
    uint256 public drawCount;

    mapping(uint256 => Draw) public draws;
    mapping(uint256 => address[]) private _entrants;
    mapping(uint256 => mapping(address => bool)) public entered;
    mapping(uint256 => mapping(address => bool)) public isWinner;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(address => uint256) public drawsEntered;

    event DrawCreated(uint256 indexed drawId, address indexed sponsor, address nft,
                      uint16 winners, uint32 closeBlock, uint32 settleBlock);
    event Entered(uint256 indexed drawId, address indexed agent, uint16 entries);
    event Settled(uint256 indexed drawId, bytes32 seed, uint16 winners);
    event SettledLate(uint256 indexed drawId, bytes32 seed, uint16 winners);
    event Claimed(uint256 indexed drawId, address indexed agent);
    event PrizeReclaimed(uint256 indexed drawId, address indexed sponsor);

    error NotAgentIdHolder();
    error AlreadyEntered();
    error EntryClosed();
    error AlreadySettled();
    error TooEarly();
    error BadParams();
    error NotWinner();
    error NotSponsor();

    constructor(address agentIdRegistry) {
        if (agentIdRegistry == address(0)) revert BadParams();
        agentId = IAgentID(agentIdRegistry);
    }

    // ---------------------------------------------------------------- create

    /// @notice Open a draw. `durationBlocks` = how long entries stay open.
    /// @dev If `nft != address(0)` the sponsor must approve this contract first
    ///      and only one winner is allowed (single token escrowed).
    function createDraw(address nft, uint256 tokenId, uint16 winners, uint32 durationBlocks)
        external
        returns (uint256 drawId)
    {
        if (winners == 0 || winners > MAX_WINNERS) revert BadParams();
        if (durationBlocks < MIN_DURATION || durationBlocks > MAX_DURATION) revert BadParams();
        if (nft != address(0) && winners != 1) revert BadParams();

        drawId = drawCount++;
        uint32 closeBlock = uint32(block.number) + durationBlocks;
        draws[drawId] = Draw({
            sponsor: msg.sender,
            nft: nft,
            tokenId: tokenId,
            closeBlock: closeBlock,
            settleBlock: closeBlock + SETTLE_DELAY,
            winners: winners,
            entries: 0,
            settled: false,
            prizeOut: false
        });

        if (nft != address(0)) {
            IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        }

        emit DrawCreated(drawId, msg.sender, nft, winners, closeBlock, closeBlock + SETTLE_DELAY);
    }

    // ----------------------------------------------------------------- enter

    /// @notice Enter a draw. Free. One entry per address, and the address must hold
    ///         at least one Binance Agent ID (one-per-KYC, non-transferable).
    function enter(uint256 drawId) external {
        Draw storage d = draws[drawId];
        if (d.settled) revert AlreadySettled();
        if (block.number >= d.closeBlock) revert EntryClosed();
        if (entered[drawId][msg.sender]) revert AlreadyEntered();
        if (agentId.balanceOf(msg.sender) == 0) revert NotAgentIdHolder();

        entered[drawId][msg.sender] = true;
        _entrants[drawId].push(msg.sender);
        unchecked {
            d.entries += 1;
            drawsEntered[msg.sender] += 1;
        }

        emit Entered(drawId, msg.sender, d.entries);
    }

    // ---------------------------------------------------------------- settle

    /// @notice Resolve the draw. Callable by anyone, inside the 256-block hash window.
    function settle(uint256 drawId) external {
        Draw storage d = draws[drawId];
        if (d.settled) revert AlreadySettled();
        if (block.number < d.settleBlock) revert TooEarly();
        if (block.number > uint256(d.settleBlock) + SETTLE_WINDOW) revert TooEarly();

        bytes32 bh = blockhash(d.settleBlock);
        if (bh == bytes32(0)) revert TooEarly();

        bytes32 seed = keccak256(abi.encodePacked(bh, drawId));
        uint16 picked = _pick(drawId, seed);
        d.settled = true;
        emit Settled(drawId, seed, picked);
    }

    /// @notice Degraded path: only after the blockhash window expired (keeper missed it).
    ///         Uses the previous block hash, which the caller does influence — hence the
    ///         distinct event, so this can never masquerade as a normal settlement.
    function settleLate(uint256 drawId) external {
        Draw storage d = draws[drawId];
        if (d.settled) revert AlreadySettled();
        if (block.number <= uint256(d.settleBlock) + SETTLE_WINDOW) revert TooEarly();

        bytes32 seed = keccak256(abi.encodePacked(blockhash(block.number - 1), drawId, "late"));
        uint16 picked = _pick(drawId, seed);
        d.settled = true;
        emit SettledLate(drawId, seed, picked);
    }

    function _pick(uint256 drawId, bytes32 seed) private returns (uint16 picked) {
        address[] storage arr = _entrants[drawId];
        uint256 n = arr.length;
        if (n == 0) return 0;

        uint16 k = draws[drawId].winners;
        if (k > n) k = uint16(n);
        picked = k;

        for (uint16 i = 0; i < k; i++) {
            uint256 j = i + uint256(keccak256(abi.encodePacked(seed, i))) % (n - i);
            address tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
            isWinner[drawId][arr[i]] = true;
        }
    }

    // ----------------------------------------------------------------- claim

    /// @notice Winning entry claims the escrowed prize (no-op on-chain if prize == 0).
    function claim(uint256 drawId) external {
        Draw storage d = draws[drawId];
        if (!d.settled || !isWinner[drawId][msg.sender] || claimed[drawId][msg.sender]) revert NotWinner();
        claimed[drawId][msg.sender] = true;
        if (d.nft != address(0)) {
            d.prizeOut = true;
            IERC721(d.nft).transferFrom(address(this), msg.sender, d.tokenId);
        }
        emit Claimed(drawId, msg.sender);
    }

    /// @notice Sponsor takes back an escrowed prize that nobody claimed, so a failed
    ///         draw can never lock an NFT in this contract forever.
    function reclaimPrize(uint256 drawId) external {
        Draw storage d = draws[drawId];
        if (msg.sender != d.sponsor) revert NotSponsor();
        if (d.nft == address(0) || d.prizeOut) revert BadParams();
        if (!d.settled) revert TooEarly();
        if (block.number < uint256(d.settleBlock) + RECLAIM_DELAY) revert TooEarly();
        d.prizeOut = true;
        IERC721(d.nft).transferFrom(address(this), d.sponsor, d.tokenId);
        emit PrizeReclaimed(drawId, msg.sender);
    }

    // ----------------------------------------------------------------- views

    function entrants(uint256 drawId) external view returns (address[] memory) {
        return _entrants[drawId];
    }

    function entryCount(uint256 drawId) external view returns (uint256) {
        return _entrants[drawId].length;
    }

    /// @notice Composable public good: is this address a verified unique agent holder?
    /// @dev Any dApp can use this for allowlists, airdrops, gating or polling.
    function isVerifiedAgent(address who) external view returns (bool) {
        return agentId.balanceOf(who) > 0;
    }
}
