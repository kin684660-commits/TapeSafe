"""Install edge-tts, then run this script with network access.
Public narration text is sent to the speech service; no credentials are needed.
"""
from pathlib import Path
import asyncio, subprocess, wave, json
import edge_tts
root=Path(__file__).resolve().parents[1]
segments=[
 ('voice-1','团队审批，能不能公开验证？','+10%'),
 ('voice-2','TapeSafe，把审批规则做成真正的电路。','+15%'),
 ('voice-3a','两票，通过。','+0%'),
 ('voice-3b','自批，无效。','+15%'),
 ('voice-3c','冻结，直接拒绝。','+20%'),
 ('voice-4','处理器和电路，已经部署在 X Layer 主网。四组结果，双节点核对。','+20%'),
 ('voice-5','让每一次团队审批，都有清晰、可信的规则。','+5%'),
]
async def main():
 for name,text,rate in segments:
  mp3=root/'public'/(name+'-natural.mp3')
  await edge_tts.Communicate(text,voice='zh-CN-XiaoxiaoNeural',rate=rate).save(str(mp3))
  subprocess.run([str(root/'node_modules/ffmpeg-static/ffmpeg'),'-y','-loglevel','error','-i',str(mp3),'-af','loudnorm=I=-18:TP=-3:LRA=7','-ar','48000','-ac','1',str(root/'public'/(name+'.wav'))],check=True)
  with wave.open(str(root/'public'/(name+'.wav'))) as w:
   assert w.getnframes()>0
   print(name, w.getnframes()/w.getframerate())
 (root/'public/audio-source.json').write_text(json.dumps({'music':'Original procedural TapeSafe score; no reference audio sampled.','seed':267,'duration':28,'narration':'Microsoft Edge zh-CN-XiaoxiaoNeural synthetic voice','segments':[{'file':name+'.wav','text':text,'rate':rate} for name,text,rate in segments]},ensure_ascii=False,indent=2)+'\n')
asyncio.run(main())
