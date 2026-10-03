import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../tapesafe_web/abi.js';
const source=readFileSync(new URL('../tapesafe_web/app.js',import.meta.url),'utf8');
const A='0x'+'11'.repeat(20), M='0x'+'22'.repeat(20), C='0x'+'33'.repeat(20), V='0x'+'44'.repeat(20);
async function setup(){
 let clock=1800000000000;const nodes=new Map();const sent=[];const handlers={};
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',addEventListener(name,fn){this[name]=fn;},insertAdjacentHTML(_where,text){this.innerHTML=text+this.innerHTML;},querySelectorAll(){return [];}});
  return nodes.get(id);
 };
 const window={ABI,TAPESAFE:{module:M,circuits:C,container:V,ruleId:'1',vaultId:'1',rpc:['mock:a','mock:b'],chainId:196,chainHex:'0xc4',explorer:'https://example.invalid'},addEventListener(name,fn){handlers[name]=fn;},ethereum:{on(name,fn){handlers[name]=fn;},async request({method,params}){if(method==='eth_requestAccounts'||method==='eth_accounts')return[A];if(method==='eth_chainId')return'0xc4';if(method==='eth_sendTransaction'){sent.push(params[0]);return'0x'+'ab'.repeat(32);}throw new Error(method);}}};
 const context={window,document:{getElementById:node},location:{hash:'#/new'},AbortSignal,Date:class extends Date{static now(){return clock;}},fetch:async(_url,{body})=>{
  const {method,params}=JSON.parse(body);let result;
  if(method==='eth_chainId')result='0xc4';
  else if(method==='eth_blockNumber')result='0x100';
  else if(method==='eth_getBlockByNumber')result={hash:'0x'+'aa'.repeat(32)};
  else if(method==='eth_getCode')result='0x6000';
  else if(method==='eth_call'){
   const data=params[0].data;
   if(data===ABI.SEL.circuits)result='0x'+ABI.word(C);
   else if(data===ABI.SEL.container)result='0x'+ABI.word(V);
   else if(data===ABI.SEL.ruleId||data===ABI.SEL.vaultId)result='0x'+ABI.word(1);
   else if(data.startsWith(ABI.SEL.previewHash))result='0x'+'ef'.repeat(32);
   else result='0x';
  }else throw new Error(method);
  return{ok:true,json:async()=>({result})};
 }};
 vm.runInNewContext(source,context);
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
 await settle();await node('connect').onclick();await settle();
 Object.entries({kind:'transfer',to:A,value:'0.1',data:'0x',hours:'24'}).forEach(([id,value])=>node(id).value=value);
 return{node,sent,handlers,advance(){clock+=5000;}};
}
test('submitting preserves the exact previewed deadline rather than recomputing it',async()=>{
 const {node,sent,advance}=await setup();
 await node('preview').onclick();advance();await node('submit').onclick();
 assert.equal(sent.length,1);
 const bytes=ABI.hexToBytes('0x'+sent[0].data.slice(10));
 assert.equal(ABI.u256At(bytes,128),1800000000n+86400n);
 assert.equal(sent[0].value,'0x0');
});
test('negative amounts and malformed calldata do not reach the wallet',async()=>{
 const {node,sent}=await setup();node('value').value='-1';
 await node('preview').onclick();await node('submit').onclick();assert.equal(sent.length,0);
 assert.match(node('app').innerHTML,/非负十进制/);
 node('value').value='1';node('data').value='0xgg';await node('preview').onclick();
 assert.match(node('app').innerHTML,/偶数位十六进制/);assert.equal(sent.length,0);
});
