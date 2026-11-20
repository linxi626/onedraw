# 提交表单 · 逐项可复制文本

> 对应表单第 1–5 项（截图）。所有链接 2026-11-20 15:35 实测：站点 200、Sourcify `exact_match`。
> 复制时请连标点一起复制，不要带 markdown 反引号。

---

## 1. 项目名称

```
OneDraw
```

## 2. 项目简介（1–3 句）

```
OneDraw 把 Agent ID"一人一身份、不可转让"的特性变成链上可复用的防女巫抽签原语：只有持有 Agent ID 的地址能报名，一个地址只能报一次，随机种子取自报名截止后的区块哈希，任何人都能独立复核结果。它解决的是链上抽奖、白名单和空投长期依赖链下快照与人工审核、无法被其他合约直接调用的问题。合约已部署在 BNB Chain 主网，源码在 BscScan 完成 Exact Match 验证并开源。
```

（若字数受限，可只用前两句。）

## 3. 项目合约地址（BscScan 链接）

```
https://bscscan.com/address/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b#code
```

已核实：Exact Match · Compiler v0.8.26+commit.8a97fa7a · Optimization Yes (200 runs) · License 公开源码可见。

## 4. 项目官网 / 产品入口

```
https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD
```

**必须带 `?sharecode=UK7Q26BERD`**。裸域名会返回 403「链接不完整」，评委点开就是空白页。

## 5. 项目社交媒体链接（X）

必填项，但项目目前还没有独立 X 账号。两个选项：

**A（建议）** 先用建号 1 分钟，发 1 条公告再填，账号有内容比空账号可信：

```
https://x.com/OneDrawBSC
```

公告推文（可直接发）：

```
OneDraw is live on BNB Chain.

One Agent ID = one entry. Sybil-resistant draws where the rule is enforced by the EVM, not by a spreadsheet.

Contract (verified): 0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b
App: https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD

Enter draw #2 before Nov 30. #AgentID #BNBChain
```

**B（今天就要交）** 填现有账号，把项目公告置顶：

```
https://x.com/Linxi_0626
```

不建议填 `@dovis_eth`：那是 8848.ai 那个 Agent 的账号，与本次提交的构建者身份不一致。

## 6. 项目如何使用 Agent ID（3–5 句）

```
OneDraw 是一个链上抽签合约，Agent ID 是它唯一的资格来源：用户调用 enter(drawId) 时，合约直接读取 SPACE ID Agent ID 合约（0x60b9262456de011f7d15a54cdd8c48baaa8b022f）的 balanceOf(msg.sender)，余额为 0 直接回滚 NotAgentIdHolder，余额大于 0 才写入报名名单。一条报名记录绑定一个地址，同一地址重复报名会被 AlreadyEntered 拒绝，因此新建空钱包刷量这条普通抽奖最大的漏洞在合约层就被堵住了。集成方式无需许可、无需对接：项目的任何第三方合约都可以直接调用我们公开的 isVerifiedAgent(address) 视图，给自己的白名单、空投或治理投票加上同样的门槛，不需要链下快照、不需要用户签名或授权。对用户的价值是复用已有身份、零额外成本——不用再做一次 KYC、不用装新工具、不用 approve，持有 Agent ID 就是参与所有接入方的同一把钥匙；对项目方的价值是把防女巫从运营工作变成一行 require。结果本身也可复核：随机种子取自报名截止后的区块哈希，任何人都能用公开 RPC 重算中签名单。
```

## 7. 主要应用场景（勾选 1–5 项）

勾这三个：

- ☑ **身份识别 / 身份验证**
- ☑ **权限管理 / 访问控制**
- ☑ **其他** → 填：

```
防女巫的公平分配：以 Agent ID 作为"一人一票"的唯一性锚点，用于抽签、白名单和空投。
```

不勾「支付/结算」「交易/DeFi 交互」——合约不涉及任何资金流转或 DeFi 头寸，勾了反而会被追问。
不勾「Agent 身份绑定/识别」——我们绑定的是"人"的 Agent ID 持有状态，不是给 Agent 做身份标识。

## 8. 产品是否已上线并可供用户体验

选 **Yes**。

依据：主网合约 + 公开场 draw #2 正在报名（4/10，11-30 12:25 截止）+ 网页端免钱包可用。

---

## 9. BNB Chain 合约地址（所有相关、需纳入统计的合约）

```
0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b
```

只有这一个。**没有代币合约**，也没有工厂/代理/多签等附属合约——不要为了显得完整而把 Agent ID 合约（`0x60b9…022f`）填进来，那不是我们的合约，填了会被判为虚报。

## 10. BscScan 合约验证链接

```
https://bscscan.com/address/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b#code
```

Exact Match，编译器 v0.8.26+commit.8a97fa7a。Sourcify 侧独立复核同为 `exact_match`：
https://sourcify.dev/server/v2/contract/56/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b?fields=all

## 11. 是否已完成 Agent ID 集成并产生链上交互

选 **Yes**。

可提供的证据（若下一项要交易哈希，直接贴这四条；都是 `enter(2)`，四个不同地址、四个独立 Agent ID）：

```
0xfa13d893cbf4a9f1d86c9e98cc824c5509bf46ea5cb94fc9e376fcd5d7ce6638
0x0c6d3747ff27ce384f9da6332051ac6557aba7792c36d1aeb7506273324d4116
0xce94c9c72b647ea95f615699d4752504151102d8d0dd6a69216259c314c6271c
0x83a14aa6d569f1d38086c2a5ce23a50dc4fb42e9a6624583fdca100067f85c3e
```

判定依据（2026-11-20 15:42 实测）：

- 合约 `agentId()` 返回值 = `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`，说明 immutable 指向的就是 Agent ID 合约本体
- 无 Agent ID 的地址调用 `enter(2)` 回滚 `0xea11784e`（= `NotAgentIdHolder()`），说明每次报名都真实读取了 Agent ID 合约的 `balanceOf`
- 上述 4 笔交易全部成功并写出 `Entered` 事件，即 4 次跨合约读取全部返回 > 0

## 12. 产品演示视频（建议 60 秒）

```
https://github.com/linxi626/onedraw/blob/main/demo.mp4
```

58 秒 · 1920×1080 · 无配音无剪辑。画面是真实线上页面与 `node demo.mjs` 真实输出的逐帧渲染，不是随手抓的录屏，也没有任何数字是后期填上去的。点开即可在线播放。

## 13. 代码仓库链接

```
https://github.com/linxi626/onedraw
```

## 14. 其他补充材料

```
产品页（免钱包可打开，链上数据实时读取）：
https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD

Demo 链接（一屏证据卡 + 一条命令自证）：
https://github.com/linxi626/onedraw/blob/main/proof.png
https://github.com/linxi626/onedraw/blob/main/demo.mjs

技术文档（设计取舍、竞品差异、诚实边界）：
https://github.com/linxi626/onedraw/blob/main/README.md
https://github.com/linxi626/onedraw/blob/main/SUBMISSION.md

独立源码验证（Sourcify，与 BscScan 交叉核验）：
https://sourcify.dev/server/v2/contract/56/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b?fields=all
```

---

## 还没填的部分

已覆盖 1–14 项。后面若有「赛道选择」「团队介绍」「是否开源」「补充材料」等字段，把截图继续发我，我按同样的方式给出可直接粘贴的文本——`SUBMISSION.md` §9 里已有英文底稿，中文版我现写。
