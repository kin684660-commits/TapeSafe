import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import '../tapesafe_web/abi.js';
export const A=globalThis.ABI;
// Obtained from Solidity 0.8.26 methodIdentifiers in the included protocol interfaces.
export const P={create:'47f9b5fd',fee:'eb2a5d2c',cpuAt:'4bc7cbbd',mint:'1b2ef1ca',price:'6817c76c',mintFee:'b0e21e8a',tapeout:'7bd3ac1d',tapeFee:'adfb2b69',eval:'934d06ea'};
export const config=()=>{const scope={window:{}};vm.runInNewContext(readFileSync(new URL('../tapesafe_web/config.js',import.meta.url),'utf8'),scope);return scope.window.TAPESAFE;};
export function address(x,label){if(!/^0x[0-9a-fA-F]{40}$/.test(x)||/^0x0{40}$/.test(x))throw new Error(`Fill valid ${label}`);return x;}
export function okb(n){n=BigInt(n);return `${n/10n**18n}.${(n%10n**18n).toString().padStart(18,'0')}`;}
export function createData(plan){
 if(!plan.name||!plan.symbol||!plan.story||!/^\d+$/.test(plan.supply)||BigInt(plan.supply)<74n||!/^\d+$/.test(plan.mintPriceWei))throw new Error('Invalid deployment plan');
 const bytes=s=>'0x'+Buffer.from(s,'utf8').toString('hex');
 return A.encode('0x'+P.create,['bytes','bytes','bytes','uint256','uint256'],[bytes(plan.name),bytes(plan.symbol),bytes(plan.story),plan.supply,plan.mintPriceWei]);
}
export const netlist=()=>readFileSync(new URL('../tapesafe_contracts/testdata/tapesafe_policy.hex',import.meta.url),'utf8').trim();
export const tapeData=()=>A.encode('0x'+P.tapeout,['bytes','uint32','uint32'],[netlist(),19,1]);
// Compare JSON by values, not provider-specific object key order. Preserve every field.
export function canonicalRPC(value){
 if(Array.isArray(value)) return value.map(canonicalRPC);
 if(value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalRPC(value[k])]));
 return value;
}
export const sameRPC=(left,right)=>JSON.stringify(canonicalRPC(left))===JSON.stringify(canonicalRPC(right));
export async function client(c){
 if(c.rpc.length<2)throw new Error('Two RPCs required');
 async function rpc(url,method,params){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();if(j.error||j.result===undefined)throw new Error(j.error?.message||'Missing RPC result');return j.result;}
 async function agree(method,params){const v=await Promise.all(c.rpc.map(url=>rpc(url,method,params)));if(v.some(x=>!sameRPC(x,v[0])))throw new Error(`RPC disagreement: ${method}`);return v[0];}
 if(BigInt(await agree('eth_chainId',[]))!==196n)throw new Error('Wrong chain');
 const heights=await Promise.all(c.rpc.map(url=>rpc(url,'eth_blockNumber',[])));
 const block='0x'+heights.map(BigInt).reduce((a,b)=>a<b?a:b).toString(16);
 const hs=await Promise.all(c.rpc.map(url=>rpc(url,'eth_getBlockByNumber',[block,false])));
 if(!hs[0]?.hash||hs.some(h=>h?.hash!==hs[0].hash))throw new Error('Block hash mismatch');
 const call=(to,data)=>agree('eth_call',[{to,data},block]);
 async function code(to){address(to,'contract');const x=await agree('eth_getCode',[to,block]);if(x==='0x')throw new Error('No contract code at '+to);return(x.length-2)/2;}
 return{rpc,agree,call,code,block,blockHash:hs[0].hash};
}
