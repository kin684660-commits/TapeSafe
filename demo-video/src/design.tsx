import React from 'react';
import {AbsoluteFill, CanvasImage, interpolate, staticFile, useCurrentFrame} from 'remotion';
export const palette={bg:'#070909',ink:'#f4efe6',muted:'#aaa69c',copper:'#e0b07a',mint:'#7ee2a8',red:'#ff7a6e'};
export const Shell:React.FC<{section:string;children:React.ReactNode}>=({section,children})=>{
 const frame=useCurrentFrame();
 return <AbsoluteFill style={{background:palette.bg,color:palette.ink,fontFamily:'PingFang SC, -apple-system, sans-serif',padding:76,backgroundImage:'radial-gradient(ellipse at 85% 5%,rgba(224,176,122,.12),transparent 55%)',opacity:interpolate(frame,[0,9],[0,1],{extrapolateRight:'clamp'})}}>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:24,letterSpacing:3,paddingBottom:24,borderBottom:'1px solid #3c3022'}}><b>TAPESAFE</b><span style={{color:palette.copper,fontSize:21}}>{section}</span></div>
 {children}
 </AbsoluteFill>;
};
export const Caption:React.FC<{children:React.ReactNode}>=({children})=><div style={{position:'absolute',left:76,right:76,bottom:56,padding:'20px 28px',background:'#121714',borderTop:'1px solid #304c3c',fontSize:36,textAlign:'center',lineHeight:1.4}}>{children}</div>;
export const BrowserFrame:React.FC<{src:string;top:number;left?:number;width?:number;height?:number;cropY?:number;scale?:number;label?:string}>=({src,top,left=660,width=1184,height=710,cropY=0,scale=1,label='真实界面截图'})=><div style={{position:'absolute',left,top,width,height,border:'1px solid #4f4030',borderRadius:18,overflow:'hidden',background:'#080a0a',boxShadow:'0 26px 80px #0009'}}>
 <div style={{height:40,background:'#181a18',fontSize:17,color:palette.muted,padding:'9px 18px',display:'flex',justifyContent:'space-between'}}><span>● ● ●</span><span>{label}</span><span>TapeSafe</span></div>
 <div style={{height:height-40,overflow:'hidden',position:'relative'}}><CanvasImage src={staticFile(src)} style={{width:1265*scale,height:'auto',position:'absolute',left:0,top:-cropY*scale}} /></div>
 </div>;
