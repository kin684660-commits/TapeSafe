// Read-only evidence collection. Never requests a key or broadcasts a transaction.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import '../tapesafe_web/abi.js';
const scope={window:{}};
vm.runInNewContext(readFileSync(new URL('../tapesafe_web/config.js',import.meta.url),'utf8'),scope);
const c=scope.window.TAPESAFE;
const required=['transistors','circuits','module','container'];
for(const k of required) if(!/^0x[0-9a-fA-F]{40}$/.test(c[k])||/^0x0{40}$/.test(c[k])) throw new Error(`Configure ${k} in tapesafe_web/config.js first`);
if(c.rpc.length<2) throw new Error('Two RPC endpoints required');
async function rpc(url,method,params){
 const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
 if(!r.ok) throw new Error(`HTTP ${r.status}`);
 const j=await r.json(); if(j.error||j.result===undefined) throw new Error(j.error?.message||'Missing result');return j.result;
}
async function agree(method,params){
 const values=await Promise.all(c.rpc.map(url=>rpc(url,method,params)));
 if(values.some(x=>JSON.stringify(x)!==JSON.stringify(values[0]))) throw new Error(`RPC disagreement: ${method}`);return values[0];
}
const chain=await agree('eth_chainId',[]);if(BigInt(chain)!==196n) throw new Error('Wrong network');
const heights=await Promise.all(c.rpc.map(url=>rpc(url,'eth_blockNumber',[])));
const block='0x'+heights.map(BigInt).reduce((a,b)=>a<b?a:b).toString(16);
const headers=await Promise.all(c.rpc.map(url=>rpc(url,'eth_getBlockByNumber',[block,false])));
if(!headers[0]?.hash||headers.some(x=>x?.hash!==headers[0].hash)) throw new Error('Block hash disagreement');
const checks={};
for(const k of required){const code=await agree('eth_getCode',[c[k],block]);if(code==='0x')throw new Error(`No code at ${k}`);checks[k+'CodeBytes']=(code.length-2)/2;}
const call=(to,data)=>agree('eth_call',[{to,data},block]);
for(const k of ['circuits','container']){const actual=ABI.decodeAddress(await call(c.module,ABI.SEL[k]));if(actual.toLowerCase()!==c[k].toLowerCase())throw new Error(`Module ${k} mismatch`);checks[k+'Binding']=true;}
for(const k of ['ruleId','vaultId']){if(ABI.decodeUint(await call(c.module,ABI.SEL[k]))!==BigInt(c[k]))throw new Error(`Module ${k} mismatch`);}
checks.custody=ABI.decodeUint(await call(c.module,ABI.SEL.custodyOk))===1n;
if(!checks.custody)throw new Error('Circuit NFT/container custody not held by module');
const info=ABI.hexToBytes(await call(c.circuits,ABI.encode(ABI.SEL.circuitInfo,['uint256'],[c.ruleId])));
checks.circuitInfo=[0,32,64,96].map(offset=>Number(ABI.u256At(info,offset)));
if(JSON.stringify(checks.circuitInfo)!=='[19,1,0,74]')throw new Error('Unexpected circuit dimensions');
// eval(uint256,bytes) selector is supplied from the ABI build artifact to avoid a guessed constant.
const artifact=JSON.parse(readFileSync(new URL('../tapesafe_contracts/out/TapeSafeFork.t.sol/ICircuits.json',import.meta.url),'utf8'));
const selector=artifact.methodIdentifiers?.['eval(uint256,bytes)'];
if(!selector)throw new Error('Run forge build first to obtain ICircuits method identifiers');
checks.vectors={};
for(const [input,want] of [['0x260001','01'],['0x260005','00']]){
 const response=await call(c.circuits,ABI.encode('0x'+selector,['uint256','bytes'],[c.ruleId,input]));
 const output=ABI.hex(ABI.readBytes(ABI.hexToBytes(response),0));
 if(output!==want)throw new Error(`Vector ${input}: got ${output}, expected ${want}`);checks.vectors[input]='0x'+output;
}
console.log(JSON.stringify({verifiedAt:new Date().toISOString(),chainId:196,block,blockHash:headers[0].hash,addresses:Object.fromEntries(required.map(k=>[k,c[k]])),ruleId:c.ruleId,vaultId:c.vaultId,checks,limitations:['Two vectors do not prove full on-chain netlist equivalence.','Processor-to-circuit association and tapeout bytecode must be checked against deployment transaction receipts.','Upgradeable protocol contracts remain a trust dependency.']},null,2));
