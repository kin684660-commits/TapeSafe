# 电路核验说明

## 主规则产物

| 项目 | 值 |
| --- | --- |
| 源码 | tapesafe_hw/tapesafe_policy.v |
| 综合输出 | tapesafe_hw/tapesafe_policy.blif |
| 流片文件 | tapesafe_hw/tapesafe_policy.nl.txt 第二行 |
| Solidity 测试字节 | tapesafe_contracts/testdata/tapesafe_policy.hex |
| 浏览器字节 | tapesafe_web/policy.js |
| NAND / LATCH | 74 / 0 |
| 输入 / 输出 | 19 / 1 |
| 原始字节数 | 518 |
| 原始字节 SHA-256 | `202a95c89f93d41aad748732e5f9614a0e61bc3add1eb0aa6d678fccf111ebc9` |

SHA-256 对解码后的 518 字节计算，不是对含 `0x` 的文本计算。根目录 `npm test` 会重新从 BLIF 导出并逐字节比较所有上述网表副本；Verilog 到 BLIF 的重新综合需另行运行硬件综合工具。

## 输入映射（按位编号）

| 位 | 含义 |
| --- | --- |
| 0–4 | 成员 A–E 批准位 |
| 5–9 | 发起人 one-hot；链上模块确保只有一位 |
| 10–14 | 必签掩码 |
| 15–17 | 最低有效批准数，小端三位整数 |
| 18 | 冻结位 |

规则：`effective = approvals & ~proposer`；未冻结、threshold > 0、有效票数达到 threshold 且必签位全部满足时输出 1。输入以三个小端字节传入；NAND 内部的 wire 索引为三字节大端，勿混用。

- A 发起、B/C 批准、门槛 2：整数 `0x010026`，ABI bytes 为 `0x260001`，输出 `0x01`。
- 相同提案冻结：整数 `0x050026`，ABI bytes 为 `0x260005`，输出 `0x00`。
- 冻结后的旧提案还会因模块 nonce 变化而拒绝执行；即使电路显示通过，也不等于提案仍可执行。

## 主网复现核验

1. 在真实网络浏览器核对 createCPU 发送者、处理器地址和电路归属；不要把工厂地址当处理器地址。
2. 查看实际 tapeout 交易 bytes 参数，解码后比对以上 SHA-256 与完整网表。
3. 调用 `circuitInfo(ruleId)`，应为 `(19, 1, 0, 74)`。
4. 固定区块执行四组代表 eval 向量：`260001 → 01`、`260005 → 00`、`220001 → 00`、`230001 → 00`。代表向量不证明全部输入等价。
5. 核对 Circuit NFT 持有人；当前实例的执行器与金库未部署，不存在 Proposed / Approved / Executed 主网执行记录。
6. 本地运行穷举测试，覆盖全部 2^19 = 524,288 种输入（包括模块正常情况下不会产生的组合）。

当前主网实例为 CPU #267 / Circuit #1，处理器和电路地址及交易见 [SUBMISSION.md](SUBMISSION.md)。分叉测试中的临时地址与该主网实例分开记录。
