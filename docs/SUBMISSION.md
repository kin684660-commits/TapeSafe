# 官方表单提交稿（0.5.0 主网电路版）

2026-10-01 核对：官方表单写明截止 10 月 6 日 12:00 HKT（北京时间）。提交当天再次查看。

[官方表单](https://docs.google.com/forms/d/e/1FAIpQLSd7USjG6LUNNRxwFWY4YEuSY0V0xv8VZNCl6z_-lGSl96vWZA/viewform?usp=dialog) · [活动规则](https://ignix.bot/x_campaign)

必填字段：收集邮箱、Project Name、Project Description、Telegram、Contact Email、GitHub Repository。X Account、X Post Link 当前未标必填。

表单没有独立的 processor/wallet/demo 栏，但规则要求这些信息；全部写入 Project Description，并在 README 中重复列出。本次 module/container/execute tx 不适用，不要填虚构地址。

## Project Name

TapeSafe

## Project Description（部署、视频与 GitHub 链接已填）

TapeSafe is an unaudited circuit-based approval-policy prototype on X Layer. A 74-NAND circuit implements minimum approval thresholds for up to five members, proposer-vote exclusion, optional mandatory signers and emergency freeze. The processor and policy circuit are deployed on X Layer. The demo compares live circuit evaluations with an interactive local execution of the same netlist. The repository contains exhaustive truth-table tests and a Solidity treasury executor validated in local and fork tests; the executor and vault are not deployed in this submission. DeWEB hosting is not used. Underlying protocol contracts remain upgradeable.

Processor (transistors): 0x7e33ea21cc11929b48b339735a61c2d4b8aed708
Deployment wallet: 0x375abb0e951addda5538e38ac5bcfce814a14752
Circuits contract: 0xe10931e0cfb42c76ced25b4712e7553f24a3d9e9
Circuit ID: 1
CPU index: 267
CreateCPU transaction: https://www.oklink.com/xlayer/tx/0x12431ca0427bf2e21bd69a3baf0396d5ab4f450caf4a45addcd3c5169b5d63df
Tapeout transaction: https://www.oklink.com/xlayer/tx/0x92300b764d3c9c5c6ab1632cbdc242183f808ce606e5f8063d942ad9a8077f7a
Demo video: https://kin684660-commits.github.io/TapeSafe/
Original MP4: https://github.com/kin684660-commits/TapeSafe/blob/main/docs/demo/TapeSafe-Demo-ZH-28s-1080p.mp4
GitHub: https://github.com/kin684660-commits/TapeSafe
Evidence: https://github.com/kin684660-commits/TapeSafe/blob/main/docs/chain-evidence.json

Issuance: supply cap 210000, mint unit price 0.000066 OKB. Protocol fees and gas still apply. 74 NAND units are used for the submitted circuit. No investment or return claim is made.

## 最后检查

文案中的供应/单价以实际部署为准；如改过 plan.json，必须同步。确认没有方括号占位符，视频和仓库无需额外权限即可访问，收据与所有地址一致。本人提交后保留确认回执。
