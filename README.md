# OneDraw

**Sybil-resistant draws for Binance Agent ID holders, on BNB Chain.**

> 1 KYC → 1 `.ai` → 1 entry.
>
> 一个 KYC 只能领一个 Agent ID，且不可转让 —— 所以持有它的地址永久绑定一个真人。
> 这句话让「一人一次」第一次能在链上强制执行。OneDraw 就是把这个属性做成一个可复用的原语。

- 合约（BSC 主网）：`0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b`
- 部署交易：`0xab3c6a64050f6c0c04935f5185f1fae81665303236bd69f510342ad281a7c5cc`
- 在线演示：https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD
- 源码仓库：https://github.com/linxi626/onedraw （MIT）
- 源码验证：BscScan `Exact Match` · Sourcify `exact_match`
- **正在开放的一场**：`drawId = 2`，10 个名额，报名截止区块 `136550926`（约 2026-11-30 12:25 北京时间）
- 参赛：Binance Wallet × BNB Chain · Agent ID Hackathon（提交材料见 [SUBMISSION.md](SUBMISSION.md)）

---

## 1. 为什么非 Agent ID 不可

任何抽签、白名单、空投都输在同一件事上：**链上无法证明"这些钱包背后是不同的人"**。一个人开 200 个钱包，项目方没有任何手段拦住。

现有的「去重」办法全都不成立：

| 办法 | 为什么不成立 |
|---|---|
| 按钱包地址去重 | 开新钱包零成本 |
| 按 ERC-20 持仓设门槛 | 可以买、可以借，且不证明"人" |
| 链下 KYC 名单 | 要信任中心化服务器，无法被其他合约组合调用 |

Agent ID 是目前唯一同时满足「链上可读、一 KYC 一个、不可转让、官方生态」的凭证。OneDraw 不把它当装饰性的门禁，而是当成**唯一性的根源**：

**「不可转让」不是听说的，是量出来的。** `verify-soulbound.mjs` 用 `eth_getLogs` 扫遍 Agent ID 注册表近期全部 `Transfer` 事件，把铸造（`from = 0x0`）和地址间转移分开计数：

```
registry 0x60b9262456de011f7d15a54cdd8c48baaa8b022f
blocks   130648639 → 134648639   (4,000,000 blocks, since 2026-10-30)
mints                 6508
address → address     0
burns                 0
failed chunks         0
```

**6,508 次铸造，0 次地址间转移。** 铸造数会随链增长而变化（每跑一次都不一样），但转移数始终是 0 —— 这才是要复核的那个数。任何人都可以跑这条命令，不依赖我们的说法。

需要说清的边界：链上能证明的是「转让路径没有被用过」，不是「转让在字节码层面被禁用」——我们没看到 revert，我们看到的是零发生。至于「一 KYC 一个」，那是 Binance / SPACE ID 的发行规则，链上无法独立验证，只能依赖其 KYC 的唯一性承诺。把这两层分开讲，比笼统宣称「完全不可伪造」更经得起追问。

```solidity
require(agentId.balanceOf(msg.sender) > 0);   // 是真人
require(!entered[drawId][msg.sender]);        // 且只算一次
// 不可转让 → 这个地址和这个人永久绑定 → 一地址一次 = 一真人一次
```

## 2. 四个动作

| 动作 | 谁做 | 说明 |
|---|---|---|
| `createDraw(nft, tokenId, winners, durationBlocks)` | 任何项目方 | 开一场抽签，可托管一件 ERC-721 作为奖品（需发起人自行 approve，然后奖品转入合约） |
| `enter(drawId)` | 持有 Agent ID 的人 | 免费，`value = 0`，每地址一次，窗口内可参与 |
| `settle(drawId)` | 任何人 | 结算区块到达后即可调用，结果由该区块哈希决定 |
| `claim(drawId)` | 中签者 | 领取托管奖品；无托管奖品时仅做链上标记 |

## 3. 随机性：谁能操纵结果？

**没有人。** 发起时就把结算区块固定下来：

```
closeBlock  = 创建区块 + durationBlocks
settleBlock = closeBlock + 1
seed        = keccak256(blockhash(settleBlock), drawId)
```

- `blockhash(settleBlock)` 在参与期内**根本不存在**，发起方也无法提前知道
- 结算时只认这一个区块的哈希，想磨结果也没有第二个种子可选
- 结算函数无权限，任何人可调 —— 谁调都不改变结果

**诚实的退化路径**：`blockhash` 只能读最近 256 个区块。如果 256 个区块内无人结算（keeper 掉线），合约提供 `settleLate()`，用上一块哈希兜底。它会发出**独立事件 `SettledLate`**，永远不会伪装成正常结算。生产版本应接 Chainlink VRF；黑客松版本选择零依赖 + 全链可审计。

**这个窗口在 BSC 上只有约 1.9 分钟**（实测 0.45 秒/块 × 256）。这不是可以调参的常数，是 `blockhash` 的物理限制。因此仓库里带了 `keeper.mjs`：它每次都优先走正常 `settle()`，只有在窗口确实过期后才退到 `settleLate()`，两条路径都不会重复结算。页面在窗口过期后也会直接给出延时结算的 calldata，任何人都能收尾。

## 4. 安全边界（刻意不做的事）

| 项 | 状态 |
|---|---|
| owner / admin / 升级代理 | **没有**。部署即不可变 |
| 提款函数 | **没有**（唯一涉及资产的路径是中签者 `claim` 或发起人 `reclaimPrize`） |
| 收用户的钱 | **不收**。`enter` 免费，`value` 恒为 0 |
| approve / permit / Permit2 | **不涉及**。参与方零授权 |
| 发代币 | **不发** |
| 奖品锁死风险 | 已处理：结算后 2000 块仍无人领取，发起人可 `reclaimPrize` 取回 |
| 合约自身余额 | 只可能暂存发起人主动转入的那一件 NFT |

合约无外部调用回调（不实现 `onERC721Received` 的接收逻辑，奖品用 `transferFrom` 而非 `safeTransferFrom`），不存在重入面。`claim` 先写 `claimed` 再转账。

## 5. 可组合性

```solidity
function isVerifiedAgent(address who) external view returns (bool);
function drawsEntered(address who) external view returns (uint256);
```

任何 dApp 都能用这两个只读函数做白名单、空投、门禁、投票。OneDraw 的定位不是"一个抽奖网页"，而是 **BNB Chain 上第一个女巫抵抗的分配原语**，抽签是它的第一个应用。

## 6. 已完成的链上验证（主网实测）

| 步骤 | 交易 | gas |
|---|---|---|
| 部署（CREATE2，地址可预测） | `0xab3c6a64…c5cc` | 1,171,766 |
| `createDraw`（2 名额 / 400 块窗口） | `0x617f2060…36e9` | 79,961 |
| `enter` × 4（四钱包） | `0x0aa62c42…a3cf` / `0x68bcdfd8…58e7` / `0x3ec5d1c7…0872` / `0x43db86dd…d08e` | 123,544 / 106,444 ×3 |
| `settle` | `0xcdbcc89a…ad4d` | 90,731 |
| `claim`（中签者） | `0xd33e6ff8…455a` | 52,249 |

结果：4 人参与、2 人中签、entrants 数组被洗牌、非中签者 `claim` 被 `0x618c7242`（NotWinner）拒绝、重复领取被拒。

**公开场 `drawId = 2`** 已开：10 个名额、开放 1,904,000 块、报名截止 `136550926`（2026-11-30 12:25 北京时间），`createDraw` tx `0x253e9291…8d61`，gas 79,973。任何人都可以在截止前用 `enter(2)` 参与。

## 7. 本地运行

**只想核实、不想花钱也不想配钱包**，跑这一条就够（只读，全程 `eth_call` / `eth_getCode`）：

```bash
npm install                 # 只需要 ethers
node demo.mjs               # 五段证据：合约无 owner / 已结算场次 / 正在报名的场次 / 三条被拒绝的路径 / public view 的 true 与 false
```

**要重跑部署与运营流程**（写入链上，需要 Binance Agentic Wallet 会话）：

```bash
npm i solc ethers           # 或使用全局安装的 solc
node compile.mjs            # 编译，产物写入 build/（bytecode / abi / metadata）
node deploy.mjs             # 只做 CREATE2 地址推导与链上比对，不发交易
node deploy.mjs --go        # 真正部署
node lifecycle.mjs all      # 完整闭环：建场 → 四地址参与 → 结算 → 领奖
node opendraw.mjs --winners 10 --hours 238      # 开一场公开抽签（干跑，打印区块与时间）
node opendraw.mjs --winners 10 --hours 238 --go # 真正发交易
node keeper.mjs             # 结算值守（干跑：报告哪些该结算）
node keeper.mjs --go        # 真正结算（优先 settle，过期才 settleLate）
node verify-sourcify.mjs    # 源码验证（无需 API key）
node verify-soulbound.mjs   # 复核 Agent ID 是否真的不可转让（扫 400 万块的 Transfer 事件）
```

编译设置被固定在 `compile.mjs` 里（solc 0.8.26 / optimizer on / runs 200）。改任何一项都会改变 metadata 哈希，进而改变 CREATE2 地址，也会让源码验证从 `exact_match` 掉级。

脚本通过 `lib/baw.mjs` 调用 Binance Agentic Wallet，配置全部走环境变量，仓库内不含任何密钥或本机路径：

| 变量 | 用途 |
|---|---|
| `BAW_JS` | `@binance/agentic-wallet/dist/index.js` 的绝对路径（推荐，绕开 Windows 命令行 8191 字符上限） |
| `BAW_BIN` | 未设 `BAW_JS` 时使用的可执行名，默认 `baw` |
| `BAW_ENVS` | 存放各钱包会话目录的父目录，默认 `~/.baw-envs` |
| `WALLET_A` … `WALLET_D` | 覆盖 `lifecycle.mjs` 里的演示地址 |
| `SPONSOR_ENV` | `opendraw.mjs` 用哪个钱包环境发起抽签，默认 `wallet-a` |
| `KEEPER_ENV` | `keeper.mjs` 用哪个钱包环境结算，默认 `wallet-a` |
| `ONEDRAW` / `BSC_RPC` | 覆盖合约地址与 RPC，便于在测试网复现 |

前端是单文件 `index.html`，无需构建，直接用任意静态托管。它**不连接钱包**，只读链上状态并生成 calldata，由用户自己在钱包里预览确认 —— 与 AgentStreak / Agent Check-In 的做法一致，避免任何签名钓鱼面。

页面不只是橱窗，它做三件实事：

1. 读出全部抽签，标出正在报名的那一场，并给出 `enter` 的 calldata
2. 结算窗口内给 `settle`，过期后自动改成 `settleLate` —— 任何访客都能收尾，不依赖我们在线
3. **「发起你自己的抽签」表单**：填名额 / 时长 / 可选 NFT，实时算出预计截止区块与时间，生成 `createDraw` 的 calldata。任何项目方不需要我们的许可就能开一场，这正是"原语"该有的样子

## 8. 源码验证

已通过 [Sourcify](https://sourcify.dev) 完成 **exact match** 验证（无需 API key，任何人可独立复现）：

- 验证记录：https://sourcify.dev/server/v2/contract/56/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b?fields=all
- 仓库产物：https://repo.sourcify.dev/contracts/full_match/56/0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b/metadata.json
- matchId `59572233`，creationMatch / runtimeMatch 均为 `exact_match`
- 编译设置与链上字节码完全一致：solc 0.8.26+commit.8a97fa7a，optimizer on，runs 200，无构造函数参数差异

复现方式（不需要任何 API key）：

```bash
node compile.mjs            # 生成 build/metadata.json
node verify-sourcify.mjs    # 提交 → 轮询 → 打印 match 类型
```

脚本会读取 `metadata.json` 里的编译设置，让 Sourcify 用同一份源码重新编译，再与链上 creation / runtime 字节码逐字节比对。`exact_match` 即证明仓库里的这份源码就是链上跑的那份。

> 注意：`src/OneDraw.sol` 在 `.gitattributes` 里被标记为 `-text`，按原样（CRLF）存储。
> 部署时编译的就是这份带 CRLF 的文件，而 metadata 哈希是对源码文本取 hash —— 行尾变了，
> 字节码尾部那 32 字节就变了，`exact_match` 也复现不出来。这不是洁癖，是复现的前提。

## 9. 路线图

- [x] 合约 + 主网部署 + 闭环实测
- [x] 源码验证（Sourcify exact match；BscScan 提交由 Sourcify 转发）
- [x] 静态站上线（https://onedraw.app.workbuddy.host/?sharecode=UK7Q26BERD）+ `skill.md`（给 agent 读的机器可读说明）
- [ ] 与 3-5 个参赛项目合作，跑真实白名单抽签
- [ ] Chainlink VRF 版本（消除 settleLate 退化路径）
- [ ] `isVerifiedAgent` 接入其他项目的门禁

## 10. 许可

MIT，见 [LICENSE](LICENSE)。合约源码首行带有 `SPDX-License-Identifier: MIT`；
BscScan 的 License 栏显示 `-NA-` 是因为验证请求由 Sourcify 经 API 转发、该字段未填，
不影响字节码与验证等级。
