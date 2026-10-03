> 优先按 [钱包部署助手](WALLET-HELPER.md) 操作，你只需连接钱包并逐笔签名。下面命令行流程保留作为备用。已确认铸造单价为 0.000066 OKB。

# TapeSafe 0.4.0 冲刺操作手册

路线：**主网创建处理器 → 铸 74 NAND → 流片一个电路 → 链上核验 → GitHub → 录视频 → 交表**。

你控制钱包并签名；工具仅查询、模拟和生成未签名参数，不保管私钥、不广播交易。本次不需要容器、执行器、域名或 DeWEB。不要运行旧版完整金库流程。

官方表单目前写明 10 月 6 日 12:00 HKT（北京时间），应提前完成。提交当天再打开表单确认。

## 1. 打开正确版本

解压 TapeSafe 当前发布包，得到 tapesafe 文件夹。终端输入 `cd `（末尾有空格），把这个文件夹拖进终端，按回车。后续命令均在该目录运行。

```sh
node --version
npm test
npm run preview
```

Node 需要 22 或以上。测试应全部通过；预览显示 http://127.0.0.1:8765。打开“电路实验室”，确认两票输出 1，自批/冻结输出 0。预览期间保留该终端，再开一个终端做后续工作。

## 2. 核对拟使用参数

打开 `deployment/plan.json`。当前建议参数如下，签名前确认接受；如要变更，先修改文件再生成交易：

| 参数 | 拟用值 |
| --- | --- |
| 名称 | TapeSafe |
| 符号 | TSAFE |
| 供应上限 | 210000 |
| mint 单价 | 0.000066 OKB |
| 用途 | 74-NAND 多签审批规则原型 |
| 公开说明 | 未审计；主网只展示处理器和电路，执行器未部署 |

铸造单价为 0.000066 OKB；74 个 NAND 的单价合计 0.004884 OKB，协议费和 gas 仍需另付。总供应上限 210000 不等于你要铸 210000 个，本次只铸 74 个。不要宣称保本、收益或已审计。

选择一个自己控制的钱包 A，全程使用它创建、铸造、流片。公开地址可以提供给协作者；助记词和私钥不要提供。钱包切到 **X Layer，chain ID 196，gas 资产 OKB**，不要用 BNB 网络或仅持有其他网络上的 OKB。

研究包建议准备约 0.02 OKB，可作预算参考，不能保证足够。每步按当前协议费和钱包估算 gas 检查余额；不需要为容器额外付费。

## 3. 创建处理器

优先打开 https://tapeout.net，选择 X Layer，连接钱包，进入创建项目/处理器。页面名称可能变化；以钱包最终显示的网络和交易为准。

填写上面的名称、符号、供应与单价；公开 story 可使用 plan.json 中的英文说明。不要省略供应、单价和用途披露。

签名前核对：

- 网络 196；发送账户为钱包 A。
- 操作是 createCPU，不是给陌生地址普通转账。
- 目标为当前核对过的 X Layer 工厂。仓库现有配置为 `0x1f09DAeFA827f02CBb40967cc91b259763760761`，其接口已在分叉上验证；如官方显示不同地址，先停下重新核对，不能仅因合约有代码就认定是官方工厂。
- 供应 210000、mint 单价 0.000066。创建费与 mint 单价不是一回事。

读取当前创建费：

```sh
npm run prepare:fees
```

2026-10-01 本次读取为 0.0066 OKB，另加 gas；最终以签名前重新查询结果为准。

**官网按钮无反应时：** 先确认是在能注入钱包的浏览器环境中操作。不要反复转币。备用工具可以生成参数并模拟：

```sh
node scripts/prepare.mjs create 0x你的公开钱包地址
```

把占位符替换为完整地址。输出中：`decoded` 是人可读参数，`transaction.to` 是目标，`transaction.data` 是完整调用数据，`valueOKB` 是发送金额；`transaction.value` 是十六进制 wei，不能把它当 OKB 填入金额栏。gas 由钱包另算。

该命令成功只代表模拟通过，**不代表已部署**。只有钱包/官方合约交互页明确支持“合约调用/自定义 data”时才使用这份数据，由你签名；若页面只有普通收款地址和金额、没有 data 栏，立即停下，发页面截图和公开地址给协作者确认。不要使用研究包旧长 hex，也不要把 JSON 整段贴进 data。

交易待确认时不要重复创建。等待收据成功，记录：创建交易哈希、部署钱包、transistors 地址、circuits 地址、CPU 编号。从创建交易事件/官方项目详情获取，不要把模拟预测地址当真实结果，也不要把官方工厂当自己的处理器地址。CPU 编号必须是工厂 cpuAt 所用编号；如果与官网展示编号偏移，核验脚本会报错，须先核对。

在 `tapesafe_web/config.js` 填入：

```js
transistors: "0x实际处理器地址",
circuits: "0x实际电路合约地址",
cpuIndex: "实际CPU编号",
```

本次保持 module、container 为空字符串。

## 4. 铸 74 个 NAND

在自己刚创建的处理器页面执行 Mint。选择 **NAND（token ID 0），数量 74**，不要选 LATCH。由钱包 A 操作。

备用参数生成：

```sh
node scripts/prepare.mjs mint 0x你的公开钱包地址
```

工具实时读取该处理器的单价和协议费，金额为 `74 × mintPrice + protocolFee`。检查目标是自己的 transistors 合约，数量 74。不要把发送金额手动改成 0：它包含 74 个 NAND 的单价合计及协议费。

钱包确认后，等交易成功，记录 mint 哈希和 NAND 余额。已有足够 NAND 时不要重复铸造。

## 5. 流片 tapesafe_policy

只流片 `tapesafe_policy`；不需要 maj3，不需要 approval_reg。

- 输入数 nIn：19。
- 输出数 nOut：1。
- 网表：`tapesafe_hw/tapesafe_policy.nl.txt` 的**第二行整段 0x 数据**。
- 不要把第一行规格说明当作交易数据，也不要把 Verilog 文本填入 bytes 参数。

若官网支持现成网表导入，使用该功能；找不到时不要手画 74 个门。生成可直接用于合约交互的参数：

```sh
node scripts/prepare.mjs tapeout 0x你的公开钱包地址
```

这里的 `transaction.data` 已经包含 tapeout 函数选择器、518 字节网表和 19/1 参数；它与 .nl.txt 的原始网表不是同一种数据。填钱包自定义 data 用前者，填合约 tapeout 的 nl 参数用后者。

钱包核对目标为自己的 circuits 合约，费用使用工具刚读取的 `valueOKB`。若模拟因余额、NAND 或权限失败，先排查，不能跳过模拟反复尝试。

交易成功后记录：流片交易哈希、实际 Circuit ID、NFT 持有人。不要假定 ID=1；不要把 NFT 转给执行器。本次流片会消耗 NAND，重复发送会额外收费/消耗余额。

填入 config.js：

```js
ruleId: "实际Circuit ID",
```

## 6. 生成评委可复核的证据

```sh
node scripts/verify-chain.mjs --tapeout-tx 0x实际流片交易哈希
```

全部成功后再保存输出：

```sh
node scripts/verify-chain.mjs --tapeout-tx 0x实际流片交易哈希 > docs/chain-evidence.json
npm run release
```

若失败，不要把空文件或部分输出当成功证据。这个流程不需要安装 forge，也不需要 module/container。

核验包括：网络、双 RPC 区块一致、两合约代码、工厂 cpuAt 对应电路、19/1/0/74 元数据、四个 eval 向量、成功的流片收据、实际交易网表与本地 518 字节一致、收据铸出的 Circuit ID 一致。

仍需人工核对：createCPU 收据里 transistors 与 circuits 的配对，以及创建者钱包。两个地址有代码本身不能证明配对正确。

## 7. 发布 GitHub 源码

在 GitHub 新建公开空仓库（例如 TapeSafe），不要预先生成 README。在本项目根目录执行以下命令；若已有仓库，先检查现有 remote，不重复初始化：

```sh
git init -b main
git add .
git status --short
git commit -m "Prepare TapeSafe circuit submission"
git remote add origin https://github.com/你的用户名/TapeSafe.git
git push -u origin main
```

这一步由你执行发布，按 GitHub 正常登录流程验证。若提示缺少 Git 作者信息，按提示设置本仓库署名，不要把访问令牌写进 remote URL。git status 中不能出现私钥、助记词、.env、node_modules、out、cache；升级 ZIP 不包含这些生成目录。

将 README 最上方补上：处理器地址、电路地址/ID、CPU 编号、部署钱包、创建和流片交易链接、视频链接。说明单价 0.000066、供应上限 210000及未审计；明确执行器与金库未部署。视频录好后再提交一次文档更新。

不要只把 ZIP 上传成仓库唯一文件；评委应能直接浏览源码和网表。

## 8. 录制 2–3 分钟演示

照 [DEMO.md](DEMO.md)：真实链上地址/交易 → 电路实验室 → 核验输出 → 测试和代码。说清楚“处理器与电路在主网；实验室在本地复现同一网表；金库执行器仅经过代码与分叉测试”。

上传到评委无需申请权限即可播放的平台。用未登录窗口打开，检查能播放、字幕/地址清楚。视频链接不是 localhost，也不是本地 mp4 路径。网页不必部署。

## 9. 填官方表单

入口：https://docs.google.com/forms/d/e/1FAIpQLSd7USjG6LUNNRxwFWY4YEuSY0V0xv8VZNCl6z_-lGSl96vWZA/viewform?usp=dialog

必填：收集邮箱、Project Name、Project Description、Telegram、Contact Email、GitHub Repository。X Account / X Post Link 当前可选。

Project Description 没有独立替代栏，因此必须把处理器地址、部署钱包、电路地址/ID、交易链接、公开视频链接放进描述。可使用 [SUBMISSION.md](SUBMISSION.md) 模板，替换全部方括号。

提交前：未登录打开仓库和视频；逐字对照地址；确保沒有占位符；截止前处理器已创建且至少一个电路已流片。你亲自点击 Submit，看到确认页面后保存回执；只填完表不等于提交成功。

## 10. 哪些情况先停下

钱包显示 BNB/其他链、出现未知授权、参数与方案不符、模拟失败、费用明显不同、交易已 pending、官网工厂地址变化：先停，保留错误文本/截图和公开交易哈希，逐项核对。不要发送密钥，不要凭印象修改 hex 或重复付费。
