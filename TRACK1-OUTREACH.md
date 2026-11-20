# Track 1 — 协作与拉新素材包

赛道一按「与本项目交互过的 Agent ID 地址数」排名。我们只有 4 个钱包，而且**绝不能刷**——
这个项目的全部价值建立在"防女巫"上，一旦刷量自我证伪，赛道二也跟着完蛋。

所以唯一正当的路径是：**让别人真的需要它，然后自己来用。**

---

## 一、给合作方的一句话版本（发消息用）

> We built OneDraw — a sybil-resistant draw primitive on BNB Chain for Agent ID holders.
> If you need to pick N winners for a whitelist / allowlist / beta access, you can run it
> on-chain in one transaction: `createDraw(nft, tokenId, winners, durationBlocks)`.
> Entry is free, one entry per Agent ID (one per KYC, non-transferable), the result is
> decided by a future block hash that nobody — including us — can influence.
> No fee, no approval from participants, and we don't sit in the middle of your prize.
>
> Live: https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD
> Contract: 0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b (verified, no owner, no withdraw)

## 二、他们为什么该用（按项目类型）

| 对方在做的事 | 为什么 OneDraw 对他们有用 | 一句话钩子 |
|---|---|---|
| 白名单 / allowlist 抽签 | 现在多半靠表单 + 人工抽，或链下随机数，无法自证公平 | "把抽签搬到链上，结果由未来区块哈希决定，你也没法作弊 —— 这反而是你的卖点" |
| NFT 免费 mint 的分配 | 先到先得会被脚本抢光，抽签能真正分散 | "别让 bot 抢完你的 supply，用 verified-human 抽签" |
| beta / 内测名额 | 名额少、想要真人 | "一人一次，链上强制，不需要你人工查重" |
| 投票 / 治理提案 | 按持币量投票 = 大户通吃 | "一人一票，靠 Agent ID 而不是余额" |
| 空投名单 | 地址女巫问题 | "先用 `isVerifiedAgent()` 过滤，再抽" |

## 三、他们实际要做的三步（3 分钟）

1. 打开演示页 → 「发起你自己的抽签」→ 填名额与开放时长 → 复制 `createDraw` calldata
2. 用自己的钱包发这笔交易（`value = 0`；若托管 NFT，先 `approve` 一次）
3. 把 drawId 和截止时间告诉你的社区，参与者复制 `enter(drawId)` 的 calldata 广播

结算：截止区块到达后，窗口内任何人调 `settle(drawId)`；错过窗口调 `settleLate(drawId)`。
两者都无权限，不需要我们在场。

## 四、可直接粘贴到 thecolony.cc 的帖子

标题：

```
[Tool] OneDraw — sybil-resistant draws for Agent ID holders (mainnet, no owner, free to use)
```

正文：

```
Most raffles on BNB Chain dedupe by wallet address, which is free to bypass.
Agent IDs are the one credential that actually maps to a distinct human: one per KYC,
non-transferable. So "one entry per address" becomes "one entry per person" — enforced
on chain, not by a spreadsheet.

OneDraw turns that into a reusable primitive rather than another check-in clone.

- createDraw(nft, tokenId, winners, durationBlocks) — anyone can open a draw, no permission
- enter(drawId) — free, value must be 0, one entry per address, requires balanceOf(AgentID) > 0
- settle(drawId) — permissionless; seed = keccak(blockhash(settleBlock), drawId), and
  settleBlock is fixed at creation, so the hash does not exist while entries are open.
  Neither the sponsor nor the settler can steer it.
- claim(drawId) — winner takes the escrowed ERC-721, if any
- isVerifiedAgent(address) — public view anyone can compose: allowlists, airdrop filters, gating

Properties: no owner, no admin, no upgrade, no withdraw function, never holds user funds,
no approve for participants. Verified source (BscScan Exact Match / Sourcify exact_match),
MIT.

Honest limitation: blockhash is readable for 256 blocks, which is ~1.9 minutes on BSC.
Miss it and settleLate() takes over with a different seed derivation and a distinct
SettledLate event, so a degraded settlement can never pass as a normal one. A production
version should use Chainlink VRF; this one trades that for zero dependencies.

If you're running a whitelist, a free mint, a beta allocation or a one-person-one-vote
poll for this hackathon, you can run it on us — open a draw in one transaction, we take
no fee and never touch your prize.

Contract: 0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b
Live: https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD
There is an open public draw right now (draw #2, 10 slots) if you want to try entering:
enter(2) costs nothing but gas.
```

## 五、优先联系谁（按匹配度排序）

| 优先级 | 对象 | 切入点 |
|---|---|---|
| 1 | 做免费 mint / allowlist 的项目（GLOOP、MintGuard、peaple.io 一类） | 他们的分配环节正好缺"防脚本 + 公平"，可以直接替换 |
| 2 | 签到类项目（AgentStreak 三个版本、Agent Check-In） | 他们已有 Agent ID 用户群，可以用抽签做回馈活动，用户直接迁移 |
| 3 | 做投票 / 治理的参赛项目 | 一人一票是他们做不到的事 |
| 4 | 任何已发 NFT、需要"下一批给谁"的项目 | 用抽签替代先到先得 |

红线：**不承诺任何回报**（没有代币、没有分成、没有空投预期）。只提供工具。一旦承诺兑现不了，
后面所有叙事都塌。

## 六、复盘口径（对我们自己）

每天的地址数记在 `draws-opened.jsonl` 和链上 `entrants(drawId)` 里，不要自己拍数字：

```bash
node keeper.mjs          # 顺带打印每场的 entries
```

如果到 12-05 地址数仍低于 15，就**不要**在提交材料里吹赛道一，把叙事收缩回"原语 + 赛道二"，
诚实说明协作还在推进。评委见过太多虚报，一个准确的 12 比一个含糊的 50 可信。
