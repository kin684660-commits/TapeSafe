> 未来完整金库的可选附录。本次不执行。文中的核验命令应使用 `npm run verify:vault`。

# 部署交接

本次升级不执行主网广播。所有地址、费用、活动时间与官方合约版本都需部署当日核对；旧 README 中的固定费用不是报价。

## 最少需要的链上步骤

1. 在 TapeOut 创建处理器，记录部署钱包、网络 196、处理器（transistors）地址、电路（circuits）地址、CPU 编号与交易哈希。供应与定价是项目方的商业选择，本仓库不替你设定。
2. 按当时协议要求准备 74 个 NAND，将 `tapesafe_hw/tapesafe_policy.nl.txt` 第二行的网表流片，输入 19、输出 1。记录实际 Circuit ID，不能假定总是 1。
3. 核对电路元数据为 19/1/0/74，验证 `0x260001 → 0x01`、`0x260005 → 0x00`。把流片交易的 bytes 参数与仓库 518 字节网表逐字节比对。
4. 若演示金库转账，开通该电路的 ERC-6551 容器，记录地址。无需购买网站域名；容器执行与网站托管是两件事。
5. 选择 3 个可实际签名的独立地址，门槛 2，必签掩码 0。发起人不能给自己的提案凑票。
6. 在 `tapesafe_contracts` 模拟部署执行器：

```sh
export CIRCUITS=0x实际电路地址
export VAULT_ID=实际金库电路ID RULE_ID=实际规则电路ID
export CONTAINER=0x实际容器地址
export THRESHOLD=2 MUST_MASK=0
export SIGNERS=0x签名人A,0x签名人B,0x签名人C
forge script script/DeployModule.s.sol --rpc-url https://xlayerrpc.okx.com
```

`SITE_REGISTRY` 可覆盖脚本中的协议地址。执行前先确认该地址是当前官方部署。脚本默认仅模拟；项目方核对后自行选择安全的钱包签名方式并广播。不要把私钥写进仓库、视频或终端历史。

7. 核对新执行器的 `circuits`、`container`、`vaultId`、`ruleId`、`signers`、`threshold`、`mustMask`、源代码与部署收据。
8. **不可逆边界：** 执行器没有转出 NFT 的函数。仅在确认上述信息正确、理解底层可升级风险后，项目方才将金库电路 NFT 安全转入执行器。错误配置可能无法恢复。
9. 填好 `tapesafe_web/config.js`，运行 `forge build`，再运行根目录 `npm run verify:chain`。核验成功后保存带区块号和区块哈希的输出作为证据。
10. 仅注入计划用于演示的小额资金，走一次实际“发起 → B 批准 → C 批准 → 执行”，确认收款变化与交易日志，然后录制。

## 配置说明

`ruleId` 是 eval 调用的电路，`vaultId` 是金库对应的 NFT；通常相同，但必须按实际部署记录。`transistors` 是处理器地址，不是电路 NFT 合约地址。脚本会核对模块与配置的绑定关系，但处理器归属与流片原始字节仍需用创建/流片收据核对。

更改配置文件后运行 `npm run release` 更新本地文件哈希。不要把本地清单当作链上完整性证明。

## 可选 DeWEB

如确实采用，先阅读当日协议文档，在 NFT 转入执行器之前完成初始上传，或之后通过 SiteOp 提案授予限时上传权限。网站升级权限与金库调用权限分别测试。不采用 DeWEB 时，不提交“页面已上链”“被换就打不开”等描述。
