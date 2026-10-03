from pathlib import Path
import numpy as np, wave, subprocess, json
root=Path(__file__).resolve().parents[1]
out=root/'public'; rate=48000; duration=28; t=np.arange(rate*duration)/rate
music=np.zeros((len(t),2),dtype=np.float64)
def hz(m):return 440*2**((m-69)/12)
chords=[[57,60,64,67],[53,57,60,64],[48,55,60,64],[55,59,62,67]]
for k,notes in enumerate(chords):
 start=k*7; mask=(t>=start)&(t<start+7); local=t[mask]-start
 env=np.minimum(local/.7,1)*np.minimum((7-local)/.8,1)
 for n in notes:
  left=(np.sin(2*np.pi*hz(n)*local)+.18*np.sin(2*np.pi*hz(n)*2*local))*.024*env
  right=(np.sin(2*np.pi*hz(n)*1.001*local)+.18*np.sin(2*np.pi*hz(n)*2.001*local))*.024*env
  music[mask,0]+=left;music[mask,1]+=right
rng=np.random.default_rng(267)
for beat in range(56):
 start=beat*.5; k=min(int(start/7),3); note=chords[k][[0,2,1,3][beat%4]]+12
 sl=(t>=start)&(t<min(start+.6,duration));local=t[sl]-start
 env=(1-np.exp(-local*80))*np.exp(-local*8)
 pluck=.1*env*(np.sin(2*np.pi*hz(note)*local)+.2*np.sin(2*np.pi*hz(note)*2*local))
 pan=.25 if beat%2 else .75;music[sl,0]+=pluck*pan;music[sl,1]+=pluck*(1-pan)
 if beat%2==0:
  kick=.085*np.exp(-local*20)*np.sin(2*np.pi*(48*local+2*(1-np.exp(-local*30))))
  music[sl,0]+=kick;music[sl,1]+=kick
 hat=.009*rng.standard_normal(len(local))*np.exp(-local*90)
 music[sl,0]+=hat;music[sl,1]+=hat
fade=np.minimum(t/1,1)*np.minimum((duration-t)/1.6,1);music*=fade[:,None]
with wave.open(str(out/'original-score.wav'),'wb') as f:
 f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes((np.clip(music,-1,1)*32767).astype('<i2').tobytes())
# Narration is generated separately with the neural voice script.
# Existing voice WAV assets remain unchanged when regenerating music.
