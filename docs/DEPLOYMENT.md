# 部署与复现

当前主网部署信息见 [MAINNET.md](MAINNET.md)。以下命令用于创建独立的处理器与规则电路实例。

## 前置条件

- Node.js 与可连接 X Layer 主网的 EVM 钱包。
- 核对 `deployment/plan.json` 中的供应、单价及公开说明。
- 在 `tapesafe_web/config.js` 配置实际处理器地址、电路地址、CPU index 与 Circuit ID。
- 使用当前协议费用，不将历史费用当作未来报价。

## 处理器与电路

```sh
npm run prepare:fees
node scripts/prepare.mjs create 0xYOUR_PUBLIC_WALLET
```

准备脚本只读取链上状态、生成未签名交易并模拟，不广播交易。创建交易确认后，将收据中的实际处理器与电路地址更新到配置。

```sh
node scripts/prepare.mjs mint 0xYOUR_PUBLIC_WALLET
node scripts/prepare.mjs tapeout 0xYOUR_PUBLIC_WALLET
```

每笔交易分别确认成功后再继续下一步。也可在本地预览中打开 `deploy.html`，使用 [钱包部署助手](WALLET-HELPER.md) 完成相同步骤。无需向脚本提供私钥。

## 验证

```sh
npm test
node scripts/verify-chain.mjs --tapeout-tx 0xYOUR_TAPEOUT_TRANSACTION
npm run release
```

核验内容包括成功收据、创建事件中的合约配对、发送者、创建和铸造参数、流片网表字节与电路结果。核验必须使用实际部署地址，不使用分叉测试中的临时地址。

## 执行器扩展

当前公开实例没有执行器或金库。扩展部署所需的 NFT 托管、配置检查与权限边界见 [VAULT-OPTIONAL.md](VAULT-OPTIONAL.md)；完整核验使用 `npm run verify:vault`，需要 Solidity 编译产物和真实执行器、容器地址。

## 静态演示页

GitHub Pages 从 `main` 分支的 `/docs` 发布公开视频播放器。产品应用的本地入口为 `npm run preview`。当前没有 DeWEB 部署。
