# 执行器与金库扩展

该扩展尚未部署。当前主网实例只提供处理器和审批规则电路，不能进行金库放款。以下流程用于开发与独立部署，需核对当前协议版本与实际地址。

## 配置与部署

1. 创建处理器并流片规则电路，核对处理器归属、网表字节、Circuit ID 和电路规格。
2. 开通对应电路的 ERC-6551 容器，记录实际容器地址。
3. 选择可签名的成员地址，配置审批门槛和必签掩码；发起人不计票。
4. 在 `tapesafe_contracts` 目录模拟部署执行器：

```sh
export CIRCUITS=0xYOUR_CIRCUITS
export VAULT_ID=YOUR_VAULT_ID RULE_ID=YOUR_RULE_ID
export CONTAINER=0xYOUR_CONTAINER
export THRESHOLD=2 MUST_MASK=0
export SIGNERS=0xSIGNER_A,0xSIGNER_B,0xSIGNER_C
forge script script/DeployModule.s.sol --rpc-url https://xlayerrpc.okx.com
```

脚本默认模拟。广播前核对网络、协议地址、执行器配置和模拟结果。`SITE_REGISTRY` 可覆盖默认协议地址。

5. 核对执行器的 `circuits`、`container`、`vaultId`、`ruleId`、`signers`、`threshold`、`mustMask` 以及部署收据。
6. 完成配置核对后，将金库电路 NFT 转入执行器。
7. 更新 `tapesafe_web/config.js`，运行 `forge build` 和根目录 `npm run verify:vault`。
8. 在受控环境验证发起、批准、执行、冻结和解冻，并检查事件和资产变化。

**NFT 托管不可撤回：** 执行器没有转出 NFT 的函数，错误电路、配置或容器可能导致资产不可恢复。底层协议可升级，详见 [安全边界](SECURITY.md)。

## 配置关系

`ruleId` 指定 eval 使用的规则电路，`vaultId` 指定金库 NFT。`transistors` 是处理器地址，`circuits` 是电路 NFT 合约地址。两类 ID 可能相同，但应以实际部署为准。

本地发布清单只用于检查文件一致性，不构成链上完整性证明。

## 可选 DeWEB

容器执行与网站托管为不同功能。采用 DeWEB 时，应分别验证初始上传、SiteOp 限时授权、网关引导和协议升级权限；当前公开实例没有 DeWEB 托管。
