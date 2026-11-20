# 90 秒演示视频 · 分镜与旁白

目标：让评委在 90 秒内看到**三件只有真做过的事才能展示的东西** —— 主网交易、被拒绝的路径、可组合的 public view。
不拍 PPT，不念白皮书，全程屏幕录制 + 旁白。

录制前 5 分钟准备：

```bash
cd hackathon/onedraw
node keeper.mjs            # 确认 draw #2 仍在报名中，记下 entries
```

浏览器预先开好三个标签页：
1. `https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD`
2. `https://bscscan.com/address/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b#code`
3. 终端（缩放到能看清字）

---

## 分镜

| 时间 | 画面 | 旁白（英文，可照读） |
|---|---|---|
| 0:00–0:08 | 页面首屏，光标停在 `1 KYC → 1 Agent ID → 1 entry` | "Every raffle on-chain dedupes by wallet. Wallets are free. Agent IDs are not — one per KYC, non-transferable. Which means one address is one person, and that can be enforced on-chain." |
| 0:08–0:20 | 滚动到「全部抽签」，高亮 draw #1 的「已结算」和 draw #2 的「报名中」 | "This is OneDraw. Two draws on BNB mainnet. Draw one is finished and settled. Draw two is open right now, ten slots, anyone with an Agent ID can enter." |
| 0:20–0:32 | 点 draw #1 展开处，展示中签名单（★ 标记） | "The contract keeps the entrant list on-chain. Two of four addresses won. You don't have to trust a screenshot — you can read it." |
| 0:32–0:45 | 点「发起你自己的抽签」，改名额与时长，calldata 实时变化 | "Anyone can open a draw. No permission, no registration, no fee. Fill in the slots and the window, and you get the exact calldata." |
| 0:45–1:00 | 切 BscScan，`#code` 页，指 `Exact Match`，再滚到函数列表指 `no owner` | "The source is verified — exact match. There is no owner, no admin, no upgrade path, and no withdraw function. It never holds user funds, and participants never approve anything." |
| 1:00–1:15 | 切终端，跑一条被拒绝的 `claim` 模拟 | "A loser cannot claim. Let me show that rather than assert it." （画面出现 revert） |
| 1:15–1:28 | 终端跑 `isVerifiedAgent` 对某个地址返回 true | "And the core check is a public view. Any project can use it for allowlists, airdrops or one-person-one-vote — without deploying anything." |
| 1:28–1:30 | 收尾：页面 + 合约地址 | "OneDraw. Sybil-resistant draws, as a primitive." |

---

## 被拒绝那条命令（1:00 段用）

用未中签的钱包 C 去 `claim`，走静态模拟就会 revert：

```bash
node -e "
const C='0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b';
const pad=n=>BigInt(n).toString(16).padStart(64,'0');
const C_WALLET='0x064b9DeDF6c802Ab0ACA45FE2B5F88C87173b613'; // draw #1 未中签
fetch('https://bsc-dataseed.binance.org',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{from:C_WALLET,to:C,data:'0x379607f5'+pad(1)},'latest']})})
 .then(r=>r.json()).then(j=>console.log(j.error ? 'REVERT → ' + j.error.message : 'unexpected success'));
"
```

预期输出：`REVERT → execution reverted: 0x618c7242`（NotWinner）。

`isVerifiedAgent` 那条：

```bash
node -e "
const C='0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b';
const a='0x6c6Ac8FFd105F74a154a000Bda1a0cBbeD2034De';
fetch('https://bsc-dataseed.binance.org',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:C,data:'0x2a82e6b8'+a.slice(2).padStart(64,'0')},'latest']})})
 .then(r=>r.json()).then(j=>console.log('isVerifiedAgent =', BigInt(j.result) === 1n));
"
```

---

## 录制建议

- 分辨率 1920×1080，终端字号调到 16px 以上，深色主题
- 用 OBS 或系统自带录屏，**不要剪太多**——评委对"一次拍完"的信任度更高
- 旁白不必完美，语速放慢，别念数字堆砌
- 不要出现任何钱包余额、私钥、助记词、本机路径
- 上传到 YouTube（unlisted 也行）或直接作为文件提交，把链接填进表单

## 不要做的事

- 不要给 draw #2 的画面打"已有 N 人参与"的假数字
- 不要说 "audited"（我们没有审计）
- 不要说 "Chainlink VRF"（我们用的是 blockhash，两种方案的区别在 README 里写清楚了，视频里不要混）
