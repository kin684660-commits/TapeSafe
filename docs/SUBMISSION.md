# TapeSafe 主网部署与证据

TapeSafe 0.5.0 的公开部署清单。当前部署覆盖 TapeOut 处理器与审批规则电路；执行器、金库和 DeWEB 未部署。

## 项目入口

- 源码：https://github.com/kin684660-commits/TapeSafe
- 中文演示：https://kin684660-commits.github.io/TapeSafe/
- MP4：https://kin684660-commits.github.io/TapeSafe/demo/TapeSafe-Demo-ZH-28s-1080p.mp4
- 电路规格：[CIRCUIT.md](CIRCUIT.md)
- 核验记录：[chain-evidence.json](chain-evidence.json)
- 部署导出：[deployment.json](deployment.json)

## 部署参数

| 参数 | 值 |
| --- | --- |
| 网络 | X Layer Mainnet |
| Chain ID | 196 |
| Processor / Transistors | `0x7e33ea21cc11929b48b339735a61c2d4b8aed708` |
| Circuits | `0xe10931e0cfb42c76ced25b4712e7553f24a3d9e9` |
| 部署钱包 / Circuit NFT owner | `0x375abb0e951addda5538e38ac5bcfce814a14752` |
| CPU index | 267 |
| Circuit ID | 1 |
| 发行上限 | 210,000 |
| 晶体管铸造单价 | 0.000066 OKB，协议费与 Gas 另付 |
| 网表 | 19 输入 / 1 输出 / 74 NAND / 0 LATCH / 518 字节 |

## 主网交易

| 操作 | 交易 |
| --- | --- |
| 创建处理器 | [0x12431ca0…](https://www.oklink.com/xlayer/tx/0x12431ca0427bf2e21bd69a3baf0396d5ab4f450caf4a45addcd3c5169b5d63df) |
| 铸造 NAND 单元 | [0x84b299e7…](https://www.oklink.com/xlayer/tx/0x84b299e7e65fadd1a5de331e8bc974ce54f45c6ee0f1aa53e83f737254eb755a) |
| 流片审批电路 | [0x92300b76…](https://www.oklink.com/xlayer/tx/0x92300b764d3c9c5c6ab1632cbdc242183f808ce606e5f8063d942ad9a8077f7a) |

## 复现核验

```sh
npm test
node scripts/verify-chain.mjs --tapeout-tx 0x92300b764d3c9c5c6ab1632cbdc242183f808ce606e5f8063d942ad9a8077f7a
```

脚本核对双 RPC 区块信息、工厂登记、处理器和电路配对、交易发送者与参数、流片字节、NFT 持有人，以及四组主网 eval 结果。本地穷举测试与主网代表向量验证的范围见 [QA.md](QA.md)。

## 当前边界

电路求值返回规则判断，不触发资金转移。金库执行器有源码和本地、分叉测试记录，未部署。项目未经过独立安全审计，底层协议合约可升级。
