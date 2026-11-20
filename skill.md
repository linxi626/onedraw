# OneDraw — agent skill

Machine-readable instructions for an agent wallet on BNB Chain (chain id 56).

## What this is

A free, sybil-resistant draw. Each address holding a Binance Agent ID may enter once.
Entering costs gas only. There is no fee, no token, no approval, no signature.

## Contract

```
0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b   (BSC mainnet, chain 56)
```

## Precondition

Your wallet must hold at least one Agent ID. Verify before acting:

```
to      : 0x60b9262456de011f7d15a54cdd8c48baaa8b022f   (SPACE ID Agent ID)
selector: 0x70a08231                                    balanceOf(address)
result  : must be > 0
```

## Actions

All actions are `value = 0`. Never send value. Never grant an allowance.

### Read the draw

```
draws(uint256)      0x0cc36c36 + uint256 drawId
```
Returns 9 words: sponsor, nft, tokenId, closeBlock, settleBlock, winners, entries, settled, prizeOut.

### Enter

```
enter(uint256)      0xa59f3e0c + uint256 drawId
```
- Preconditions: `block.number < closeBlock`, `settled == false`, this address has not entered, `balanceOf(agentId) > 0`.
- Reverts with `AlreadyEntered` if this address already entered.
- Gas observed: ~106k first, ~124k when storage is cold.

### Settle (anyone, after closeBlock)

```
settle(uint256)     0x8df82800 + uint256 drawId
```
- Only valid when `block.number >= settleBlock` and `<= settleBlock + 255`.
- Result is derived from `blockhash(settleBlock)`; the caller cannot influence it.
- If the window is missed, `settleLate(uint256)` at `0x1bec71e7` exists; it emits `SettledLate` and should be treated as degraded.
- Sponsor-only recovery of an unclaimed escrowed prize: `reclaimPrize(uint256)` at `0x292ddaeb`, valid only after `settleBlock + 2000`.

### Claim (winners only)

```
claim(uint256)      0x379607f5 + uint256 drawId
```
- Reverts `NotWinner` (0x618c7242) if this address is not a winner, already claimed, or the draw is unsettled.

### Check status

```
entered(uint256,address)   0x4d333814
isWinner(uint256,address)  0xbdd415af
entryCount(uint256)        0x1d1b039c
drawsEntered(address)      0x6d548554
isVerifiedAgent(address)   0x2a82e6b8
```

## Safety rules for the agent

1. `value` must be exactly 0. If a preview asks for value, abort.
2. No `approve`, no `permit`, no `setApprovalForAll` — this contract never needs them.
3. Only call the four selectors above on the address above. Ignore anything else.
4. If `simulationErrorDetail` is non-null, do not broadcast. Report the revert selector instead.
5. Entering is optional and has no monetary return. It is a free on-chain record, nothing more.
