import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../tapesafe_web/abi.js';
import '../tapesafe_web/policy.js';
import '../tapesafe_web/deploy-core.js';
import {createData,tapeData} from '../scripts/protocol.mjs';
const plan=JSON.parse(readFileSync(new URL('../deployment/plan.json',import.meta.url),'utf8'));
test('wallet helper encodes exactly the reviewed create and tapeout payloads',()=>{
 assert.equal(DeployCore.create(),createData(plan));assert.equal(DeployCore.tapeout(),tapeData());
 assert.equal(DeployCore.okb(74n*66000000000000n),'0.004884');
});
async function setup(){
 const nodes=new Map(),storage=new Map(),sent=[],pending=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,hidden:false,textContent:'',innerHTML:''});return nodes.get(id);};
 const wallet='0x'+'11'.repeat(20),tokens='0x'+'22'.repeat(20),circuits='0x'+'33'.repeat(20),factory='0x'+'44'.repeat(20);
 const transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
 const provider={request:async({method,params=[]})=>{
  if(method==='eth_requestAccounts'||method==='eth_accounts')return[wallet];
  if(method==='eth_chainId')return'0xc4';if(method==='eth_blockNumber')return'0x100';
  if(method==='eth_getCode')return'0x6000';
  if(method==='eth_gasPrice')return'0x1';if(method==='eth_estimateGas')return'0x10000';
  if(method==='eth_getBalance')return'0x'+(10n**18n).toString(16);
  if(method==='eth_call'){
   const data=params[0].data;
   if(data==='0x'+DeployCore.P.count)return'0x'+ABI.word(1);
   if(data==='0x'+DeployCore.P.fee)return'0x'+ABI.word(6600000000000000n);
   if(data==='0x'+DeployCore.P.price)return'0x'+ABI.word(66000000000000n);
   if(data==='0x'+DeployCore.P.mintFee)return'0x'+ABI.word(660000000000000n);
   if(data==='0x'+DeployCore.P.tapeFee)return'0x'+ABI.word(1300000000000000n);
   if(data.startsWith('0x'+DeployCore.P.at))return'0x'+ABI.word(circuits);
   if(data.startsWith('0x'+DeployCore.P.create))return'0x'+ABI.word(tokens)+ABI.word(circuits);
   if(data.startsWith('0x'+DeployCore.P.tapeout))return'0x'+ABI.word(1);
   if(data.startsWith(ABI.SEL.circuitInfo))return'0x'+[19,1,0,74].map(ABI.word).join('');
   if(data.startsWith('0x'+DeployCore.P.eval)){
    const bytes=ABI.hexToBytes('0x'+data.slice(10));const input=ABI.hex(ABI.readBytes(bytes,32));
    return ABI.encode('0x',['bytes'],[input==='260001'?'0x01':'0x00']);
   }
   return'0x';
  }
  if(method==='eth_sendTransaction'){
   const tx=params[0];sent.push(tx);const hash='0x'+String(sent.length).padStart(64,'0');pending.set(hash,tx);return hash;
  }
  if(method==='eth_getTransactionByHash')return{...pending.get(params[0]),input:pending.get(params[0]).data};
  if(method==='eth_getTransactionReceipt'){
   const tx=pending.get(params[0]);let logs=[];
   if(tx.data.startsWith('0x'+DeployCore.P.create))logs=[{address:tokens},{address:circuits}];
   if(tx.data.startsWith('0x'+DeployCore.P.tapeout))logs=[{address:circuits,topics:[transfer,'0x'+ABI.word(0),'0x'+ABI.word(wallet),'0x'+ABI.word(1)]}];
   return{status:'0x1',blockNumber:'0x100',logs};
  }
  throw new Error(method);
 }};
 const window={ABI,DeployCore,TAPESAFE:{factory},ethereum:provider};
 const context={window,document:{getElementById:node},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout,TextEncoder,Blob,URL};
 vm.runInNewContext(readFileSync(new URL('../tapesafe_web/deploy.js',import.meta.url),'utf8'),context);
 await node('connect').onclick();return{node,sent};
}
test('preparation never sends; three explicit confirmations produce correct fees and records',async()=>{
 const {node,sent}=await setup();
 await node('create').onclick();assert.equal(sent.length,0);assert.equal(node('review').hidden,false);
 await node('sign').onclick();assert.equal(sent.length,1);assert.match(node('result').textContent,/transistors/);
 await node('mint').onclick();assert.equal(sent.length,1);assert.match(node('summary').innerHTML,/0.005544 OKB/);
 await node('sign').onclick();assert.equal(BigInt(sent[1].value),5544000000000000n);
 await node('tapeout').onclick();assert.equal(sent.length,2);await node('sign').onclick();
 assert.equal(sent.length,3);const result=JSON.parse(node('result').textContent);
 assert.equal(result.tapeout.ruleId,'1');assert.deepEqual(result.tapeout.circuitInfo,[19,1,0,74]);assert.equal(result.pending,undefined);
});
