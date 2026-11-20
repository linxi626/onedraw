# OneDraw — submission pack

> Binance Wallet × BNB Chain · Agent ID Hackathon
> Deadline: 2026-12-09 16:00 (UTC+8). Everything below is live on BNB Chain mainnet today.

| | |
|---|---|
| Live app | https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD |
| Contract | `0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b` |
| Verified source | https://bscscan.com/address/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b#code (Exact Match) |
| Independent match | https://sourcify.dev/server/v2/contract/56/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b?fields=all (`exact_match`) |
| Deploy tx | `0xab3c6a64050f6c0c04935f5185f1fae81665303236bd69f510342ad281a7c5cc` |
| Open now | draw #2 — 10 slots, entries close at block `136550926` (2026-11-30 12:25 UTC+8) |
| Source repo | this folder (`git` initialised, ready to push) |
| Demo script | [DEMO-VIDEO.md](DEMO-VIDEO.md) · Partner kit: [TRACK1-OUTREACH.md](TRACK1-OUTREACH.md) |

---

## 1. One-liner

**OneDraw turns the Agent ID's "one KYC, one ID, non-transferable" property into a
reusable sybil-resistance primitive for allocation — first application: provably fair draws.**

## 2. Short pitch (150 words)

Every raffle, allowlist and airdrop on chain dies of the same disease: a wallet is free
to create, so "one wallet, one entry" is a wish, not a rule. Projects answer with
off-chain snapshots, holding thresholds, or hand-curated lists — all of which require
trust and none of which other contracts can compose.

An Agent ID is different. It is one per KYC, non-transferable, and readable on chain.
That makes the holding address a proxy for a person, permanently. OneDraw uses that as
its uniqueness root and nothing else: `balanceOf(agentId) > 0` and one entry per address,
and the raffle becomes one-entry-per-human *enforced by the EVM*.

The result is a primitive, not a website. Any project can call `isVerifiedAgent(address)`
today to gate an allowlist, a drop, or a vote without building any of this themselves.

## 3. Description (300 words)

**The problem.** Allocation is the weakest link in every on-chain launch. Sybil resistance
is always either off-chain (snapshots, KYC lists — unverifiable, non-composable) or fake
(holding thresholds — buyable, borrowable, and still silent about "how many humans").

**The insight.** Binance Agent ID is the first credential that is simultaneously on-chain,
one-per-KYC, non-transferable, and officially issued. The ecosystem so far uses it as a
decorative gate: check `balanceOf > 0`, then let the user through. That wastes the only
property that actually matters — **because the ID cannot move, the address it sits in is
bound to one person forever.** Combine that with one entry per address and you get
one entry per human, without a single off-chain assumption.

**The product.** OneDraw is four functions: `createDraw`, `enter`, `settle`, `claim`.
Entry is free — `value` must be 0, no approve, no signature, no server. Settlement is
permissionless: anyone can call it once the pre-committed block is mined, and the winner
is derived from that block's hash. The seed is fixed at creation time, so during the entry
window the number does not exist yet — neither the sponsor nor the settler can grind it.

**Safety by subtraction.** No owner, no admin, no upgrade path, no withdraw function. The
only way value moves is a winner's `claim`, or a sponsor's `reclaimPrize` if nobody claims
within 2000 blocks. The contract never holds user funds and never takes a fee.

**Composability.** `isVerifiedAgent(address)` and `drawsEntered(address)` are public views.
Any dApp can adopt the primitive without touching OneDraw's draw logic — the draw is just
the demo that proves the primitive works end to end.

**Status.** Live on BNB Chain, source verified (Exact Match), and exercised on mainnet:
4 participants, 2 winners drawn from a shuffled entrant array, non-winner and double-claim
both rejected on chain.

---

## 4. Why this is Agent-ID-native, not Agent-ID-flavoured

| | Typical hackathon entry | OneDraw |
|---|---|---|
| What the Agent ID does | `balanceOf > 0` gate, then normal logic | the **only** source of uniqueness — the whole anti-sybil claim rests on non-transferability |
| If you removed Agent ID | app still works, minus a badge | app has no sybil resistance at all; it degrades to "one wallet, one entry" |
| What it gives back to the ecosystem | nothing callable | `isVerifiedAgent()` as a shared primitive others can build on |

## 5. Trust and safety properties

| Property | Implementation |
|---|---|
| No privileged role | no `Ownable`, no proxy, no upgrade; deployment is final |
| No fund custody | entry is free, `value` fixed at 0; only an ERC-721 explicitly escrowed by a sponsor is held |
| No approvals requested | participants never call `approve` / `permit` / `setApprovalForAll` |
| Unmanipulable randomness | `seed = keccak256(blockhash(settleBlock), drawId)`, `settleBlock` fixed at creation |
| Degradation is visible | if the 256-block window is missed, `settleLate()` emits a distinct `SettledLate` event — it can never masquerade as a normal settlement |
| No prize can be locked forever | `reclaimPrize()` after 2000 blocks returns an unclaimed NFT to the sponsor |
| No reentrancy surface | prizes move via `transferFrom`; `claim` writes state before transferring |

Honest limitation: `settleLate()` uses the previous block hash, which a settler can bias.
It exists only as a last resort after the window expires, is separately evented, and is
documented as degraded. A production version replaces it with Chainlink VRF.

## 5b. The premise, measured rather than assumed

Everything here rests on one sentence: an Agent ID cannot be moved between people. That is
checkable, so we checked it instead of citing it.

`verify-soulbound.mjs` walks every `Transfer` event the Agent ID registry emitted over
4,000,000 blocks (since 2026-10-30) and separates mints from address-to-address moves:

```
mints                 6508
address → address     0
burns                 0
failed chunks         0
```

Zero moves across 6,508 minting events. Two honest limits, stated up front:

- On-chain we can prove *the transfer path was never used*, not that the bytecode forbids it.
  Zero occurrences, not a revert.
- "One KYC, one ID" is an issuance rule of Binance / SPACE ID; it cannot be verified from the
  chain, only trusted. The sybil-resistance guarantee is therefore "one address = one
  KYC-verified Binance account", which is the strongest claim the data actually supports.

Anyone can reproduce the number: `node verify-soulbound.mjs`. The mint count drifts as the
chain grows; the transfer count is the one that matters and it is zero.

## 6. On-chain evidence (all mainnet, no mocks)

| Step | Tx | Gas |
|---|---|---|
| Deploy (CREATE2, address predictable) | `0xab3c6a64…c5cc` | 1,171,766 |
| `createDraw` (2 slots / 400-block window) | `0x617f2060…36e9` | 79,961 |
| `enter` × 4 (four distinct Agent ID holders) | `0x0aa62c42…a3cf` · `0x68bcdfd8…58e7` · `0x3ec5d1c7…0872` · `0x43db86dd…d08e` | 123,544 / 106,444 ×3 |
| `settle` (2 winners drawn) | `0xcdbcc89a…ad4d` | 90,731 |
| `claim` (winner) | `0xd33e6ff8…455a` | 52,249 |
| Non-winner `claim` | rejected with `NotWinner()` `0x618c7242` | — |
| Repeat `claim` | rejected | — |
| `createDraw` — public draw #2 (10 slots, 1,904,000 blocks) | `0x253e9291…8d61` | 79,973 |

Full hashes and decoded state: `draw.json`, `deployed.json`, `draws-opened.jsonl`; the same
draws are rendered live on the demo site, including the on-chain entrant list with winners
marked, so nothing has to be taken on trust.

Draw #2 is open for entries until block `136550926` — a judge holding an Agent ID can
enter it during judging and see the result settle afterwards. That is the point: the
submission is not a recording of something that happened, it is a live contract.

**One number worth stating plainly**: `blockhash` is only readable for 256 blocks, which on
BSC (0.45 s/block, measured) is about **1.9 minutes**. That is a property of the EVM, not a
tunable parameter. The contract therefore ships two settlement paths — `settle()` inside the
window, `settleLate()` after it, with a distinct `SettledLate` event so a degraded settlement
can never pass as a normal one — and `keeper.mjs` prefers the normal path automatically.
Any visitor can also trigger either from the page, so settlement does not depend on us being
online.

## 7. Track 1 — ecosystem reach (how we plan to earn it honestly)

Track 1 rewards how many distinct Agent ID addresses interact with the project. A
sybil-resistance project cannot buy that with sybils; doing so would falsify its own thesis.
So the plan is to be *used*, not to inflate:

1. Offer other hackathon teams a free, neutral draw for their own allowlists / WL spots.
   They get a fair, screenshot-able distribution; we get real distinct Agent ID addresses.
2. Run a "which project should get the community prize" poll — every voter is an Agent ID
   holder, and the result is a public artefact other teams want to be part of.
3. Keep entry at exactly one tx per address, no batching helpers, no referral multipliers.

## 8. Track 2 — how this scores against judging criteria

| Criterion | Evidence |
|---|---|
| Originality | No other entry in the pool does draws/allowlists/sybil resistance; the pool is crowded with escrow (12) and attestation (17) |
| Depth of Agent ID use | The uniqueness proof *is* the product; removing Agent ID removes the app's reason to exist |
| Technical execution | 226-line contract, no external deps, mainnet-tested lifecycle, exact-match verified source, reproducible build |
| Real usage | 4 distinct holders participated and the draw settled on mainnet before submission |
| Composability | `isVerifiedAgent()` / `drawsEntered()` are public goods other projects can adopt today |
| Risk hygiene | no admin key, no custody, no approvals, documented degraded path |

## 9. Submission form — field by field

| Field | Value |
|---|---|
| Project name | OneDraw |
| Tagline | One Agent ID, one entry — sybil-resistant draws on BNB Chain |
| Track | Application Innovation (Track 2); also competing on ecosystem reach (Track 1) |
| Live demo | https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD |
| Contract (BSC) | `0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b` |
| Verified source | BscScan `#code` (Exact Match) + Sourcify `exact_match` |
| Repo | push this folder to GitHub, then paste the URL |
| Demo video | 90s: open site → show a live draw → show `isVerifiedAgent` returning true → show the rejected non-winner `claim` |
| Team | 1 builder |

## 10. Open items before submitting

- [x] contract on mainnet, source verified, lifecycle tested
- [x] live demo page published
- [x] repo prepared (git history, LICENSE, sanitised scripts, no keys)
- [x] core premise measured on-chain (zero transfers across 6,508 mints)
- [x] a public draw is live for the judging window (draw #2, closes 2026-11-30)
- [ ] push repo to GitHub (needs account access)
- [ ] 90-second demo video (shot list + narration ready in [DEMO-VIDEO.md](DEMO-VIDEO.md))
- [ ] 3-5 partner draws scheduled (Track 1) — outreach copy ready in [TRACK1-OUTREACH.md](TRACK1-OUTREACH.md)
- [ ] Chainlink VRF version (optional, post-submission)
