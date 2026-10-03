import {Audio} from '@remotion/media';
import {AbsoluteFill,Composition,Folder,Sequence,staticFile} from 'remotion';
import {Opening} from './Opening';import {Product} from './Product';import {Approval} from './Approval';import {Verification} from './Verification';import {Closing} from './Closing';
export const TapeSafeDemo=()=> <AbsoluteFill style={{background:'#070909'}}>
 <Sequence from={0} durationInFrames={120} name="01 Team approval"><Opening/></Sequence>
 <Sequence from={120} durationInFrames={120} name="02 TapeSafe product"><Product/></Sequence>
 <Sequence from={240} durationInFrames={210} name="03 Approval replay"><Approval/></Sequence>
 <Sequence from={450} durationInFrames={210} name="04 Mainnet verification"><Verification/></Sequence>
 <Sequence from={660} durationInFrames={180} name="05 Public evidence"><Closing/></Sequence>
 <Audio src={staticFile('original-score.wav')} volume={0.48}/>
 <Sequence from={10} durationInFrames={110} name="Opening narration"><Audio src={staticFile('voice-1.wav')} volume={1}/></Sequence>
 <Sequence from={128} durationInFrames={112} name="Product narration"><Audio src={staticFile('voice-2.wav')} volume={1}/></Sequence>
 <Sequence from={247} durationInFrames={63} name="Two approvals narration"><Audio src={staticFile('voice-3a.wav')} volume={1}/></Sequence>
 <Sequence from={317} durationInFrames={63} name="Proposer excluded narration"><Audio src={staticFile('voice-3b.wav')} volume={1}/></Sequence>
 <Sequence from={387} durationInFrames={63} name="Freeze narration"><Audio src={staticFile('voice-3c.wav')} volume={1}/></Sequence>
 <Sequence from={456} durationInFrames={204} name="Mainnet narration"><Audio src={staticFile('voice-4.wav')} volume={1}/></Sequence>
 <Sequence from={668} durationInFrames={172} name="Closing narration"><Audio src={staticFile('voice-5.wav')} volume={1}/></Sequence>
 </AbsoluteFill>;
export const RemotionRoot=()=> <>
 <Composition id="TapeSafe-Demo-ZH-28s" component={TapeSafeDemo} durationInFrames={840} fps={30} width={1920} height={1080}/>
 <Folder name="TapeSafe-Scenes">
 <Composition id="Opening" component={Opening} durationInFrames={120} fps={30} width={1920} height={1080}/>
 <Composition id="Product" component={Product} durationInFrames={120} fps={30} width={1920} height={1080}/>
 <Composition id="Approval" component={Approval} durationInFrames={210} fps={30} width={1920} height={1080}/>
 <Composition id="Verification" component={Verification} durationInFrames={210} fps={30} width={1920} height={1080}/>
 <Composition id="Closing" component={Closing} durationInFrames={180} fps={30} width={1920} height={1080}/>
 </Folder>
 </>;
