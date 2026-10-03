# TapeSafe 中文演示视频工程

28 秒，1920×1080，30 fps；真实浏览器交互截图、中文合成旁白与原创程序合成配乐。参考视频只用于理解讲解节奏，未复制其画面、旁白或音乐。

## 复现渲染

```sh
npm ci
npx remotion render src/index.ts TapeSafe-Demo-ZH-28s output/TapeSafe-Demo-ZH-28s-1080p.mp4 --codec=h264 --pixel-format=yuv420p
```

首次渲染会下载 Remotion 官方 Chrome Headless Shell。已有全部画面和音频资源，不需要 API Key。编辑预览：`npm run dev`。

`src/Root.tsx` 是可编辑时间线；各场景分别注册。`scripts/make-audio.py` 生成原创配乐，需要 Python / NumPy。`scripts/make-narration.py` 使用 edge-tts 和 XiaoxiaoNeural 中文神经网络语音生成旁白，需要联网；运行前安装 edge-tts。语音仍为合成声音，已有全部 WAV，直接渲染无需访问语音服务。

## 场景

0–4 秒：团队审批问题；4–8 秒：产品和电路规格；8–15 秒：两票通过、自批无效、冻结拒绝；15–22 秒：主网部署与双 RPC 求值；22–28 秒：项目愿景口号，附部署范围小字。

截图来自实际页面操作；这是截图剪辑演示，不是连续录屏。实验室在浏览器执行网表，核验页是实际主网只读结果。`public/` 保留视频使用的截图与音频，`public/audio-source.json` 记录配乐和旁白来源。

本次仅处理器和规则电路已部署，执行器/金库未部署；未审计，底层协议可升级。
