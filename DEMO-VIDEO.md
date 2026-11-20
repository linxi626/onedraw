# 90 秒演示视频 · 分镜、旁白、录屏步骤

目标：让评委在 90 秒内看到**三件只有真做过才拿得出来的东西** —— 主网交易、被合约拒绝的路径、可被别的项目直接调用的 public view。

不拍 PPT，不念白皮书。全程屏幕录制 + 旁白，一次拍完不剪接。

---

## 0. 录制前 3 分钟

```bash
cd hackathon/onedraw
npm install          # 只需一次
node demo.mjs        # 先跑一遍，确认五段输出都正常
```

把 `demo.mjs` 的输出窗口留着，录制时直接用它，**不要现场手打 `node -e`**（手打容易错、画面也乱）。

浏览器开好三个标签页，顺序就是出现顺序：

1. `https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD`
2. `https://bscscan.com/address/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b#code`
3. 终端（深色主题，字号 ≥16px，窗口拉宽到 1100px 以上）

终端里预先执行一次 `node demo.mjs`，让它在屏幕上留好输出；录制时滚到 `[4]` 和 `[5]` 即可，不必重跑等待。

---

## 1. 分镜表

| 时间 | 画面 | 旁白（英文，可照读） |
|---|---|---|
| 0:00–0:09 | 页面首屏，光标停在 `1 KYC → 1 Agent ID → 1 entry` | "Every raffle on-chain dedupes by wallet. Wallets are free. Agent IDs are not — one per KYC, non-transferable. So one address is one person, and that can be enforced on-chain." |
| 0:09–0:22 | 向下滚到「全部抽签」，先停在 draw #1「已结算」，再停在 draw #2「报名中」 | "This is OneDraw. Two draws on BNB mainnet. Draw one is finished and settled. Draw two is open right now — ten slots, four already taken, and anyone holding an Agent ID can enter." |
| 0:22–0:34 | 停在 draw #1 卡片，指中签名单里的 ★ | "The entrant list lives on-chain, not in a screenshot. Four addresses entered, two won, and you can read all of it yourself." |
| 0:34–0:46 | 点开「发起你自己的抽签」，改名额 10 → 3、时长 72h → 24h，calldata 跟着变 | "Opening a draw needs no permission and no fee. Pick the slots and the window, and the page gives you the exact calldata. Nothing is deployed for you — you call the same contract." |
| 0:46–1:00 | 切 BscScan `#code`：指 `Exact Match`，再滚到函数列表 | "Source is verified — exact match. And look at the function list: no owner, no admin, no upgrade, no withdraw. It never holds user funds, and participants never approve a token." |
| 1:00–1:15 | 切终端，滚到 `[4] what the contract refuses` | "A loser cannot claim. A winner cannot claim twice. An address with no Agent ID cannot even enter. Here are the actual revert selectors — this is the chain refusing, not me asserting." |
| 1:15–1:26 | 滚到 `[5] the reusable part`，指 true / false 两行 | "And the whole check is one public view. True for a holder, false for everyone else. Any project can call it for allowlists, airdrops or one-person-one-vote, without deploying anything." |
| 1:26–1:30 | 回到页面，停在合约地址 | "OneDraw. Sybil-resistant draws, as a primitive." |

**旁白总字数约 205 词**，正常语速 90 秒刚好；如果念快了，优先慢下来而不是删句子 —— 第 1:00 那段的"三个拒绝"是整支片子最有说服力的部分。

---

## 2. 终端那两段（1:00 起）

一条命令跑完五段证据，只读，不签名、不花钱：

```bash
node demo.mjs
```

录制时会看到（2026-11-20 实测，每次运行数字会变，措辞不用改）：

```
OneDraw — read-only proof run · BNB Chain mainnet
contract  0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b

[1  the contract]
  runtime bytecode                  5,151 bytes
  owner()                           reverts  ->  no owner
  admin-ish functions in ABI        none

[2  draw #1 — finished]
  entries                           4
  winners                           2
  settled                           true
  listed on chain                   0x2bAd...0a77 *  0x6c6A...34De *  0x064b...b613  0x69Cc...2284

[3  draw #2 — open now]
  slots                             10
  entries so far                    4
  closes at block                   136550926  (in ~1,897,618 blocks, ~9.9 days)

[4  what the contract refuses]
  claim(draw 1) by a non-winner     reverted 0x618c7242  NotWinner()
  claim(draw 1) twice by a winner   reverted 0x618c7242  NotWinner()
  enter(draw 2) with no Agent ID    reverted 0xea11784e  NotAgentIdHolder()

[5  the reusable part (a public view)]
  isVerifiedAgent(0x6c6A...34De)    true
  isVerifiedAgent(0x0000...dEaD)    false
```

`*` 是中签地址。第 3 段的剩余块数每天都在减，旁白不要念具体数字。

**录制要点**：画面里只出现 `[4]` 和 `[5]` 两段就够，别让评委读十行小字。字幕里已经写好对应的英文，观众听到的和看到的要一致。

---

## 3. 字幕

`demo.srt` 已按上面的分镜配好时间轴，导入剪辑软件（或直接作为 Soft subtitle 上传）即可。改旁白时记得同步改字幕，否则口型和文字会打架。

---

## 4. 录制建议

- 1920×1080，60fps 不必，30fps 够；终端字号 16px 以上，深色主题
- OBS 或系统自带录屏，**一次拍完，不剪接**——评委对"一条过"的信任度更高
- 先静音彩排一遍走位（开关标签页、滚动位置），再开麦正式录
- 语速放慢；数字只念"ten slots""two won"这种，别念区块高度
- 不要出现钱包余额、私钥、助记词、本机路径（`demo.mjs` 输出里已无路径）
- 上传 YouTube（unlisted 即可）或直接交 mp4，链接填进表单的 Demo video 字段

## 5. 不要做的事

- 不要给 draw #2 打"已有 N 人参与"的假数字（现在就是 0，实话反而更有说服力：刚开）
- 不要说 "audited" —— 没有审计
- 不要说 "Chainlink VRF" —— 用的是 blockhash，两者区别在 README 里写清楚了，视频里别混
- 不要念"我们解决了 sybil resistance"这种大词，念具体的那三条 revert
