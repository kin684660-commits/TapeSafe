// Emits an unsigned transaction plan only. No signing or broadcasting method exists here.
import {readFileSync} from 'node:fs';
import {A,P,config,address,okb,createData,tapeData,client} from './protocol.mjs';
const stage=process.argv[2];const wallet=process.argv[3];
if(!['fees','create','mint','tapeout'].includes(stage))throw new Error('Usage: node scripts/prepare.mjs fees | create|mint|tapeout 0xYOUR_PUBLIC_WALLET');
const c=config(),r=await client(c);
await r.code(c.factory);
if(stage==='fees'){
 const fee=BigInt(await r.call(c.factory,'0x'+P.fee));
 console.log(JSON.stringify({chainId:196,block:r.block,factory:c.factory,createFeeOKB:okb(fee),note:'Live read only. Mint and tapeout fees must be read from your deployed contracts. Gas extra.'},null,2));
}else{
 address(wallet,'public wallet');let to,data,value,decoded;
 if(stage==='create'){
  const plan=JSON.parse(readFileSync(new URL('../deployment/plan.json',import.meta.url),'utf8'));
  to=c.factory;data=createData(plan);value=BigInt(await r.call(to,'0x'+P.fee));decoded=plan;
 }else if(stage==='mint'){
  to=address(c.transistors,'config.transistors');await r.code(to);
  const price=BigInt(await r.call(to,'0x'+P.price)),fee=BigInt(await r.call(to,'0x'+P.mintFee));
  data=A.encode('0x'+P.mint,['uint256','uint256'],[0,74]);value=price*74n+fee;
  decoded={tokenId:0,amount:74,mintPriceWei:String(price),protocolFeeWei:String(fee)};
 }else{
  to=address(c.circuits,'config.circuits');await r.code(to);data=tapeData();value=BigInt(await r.call(to,'0x'+P.tapeFee));decoded={nIn:19,nOut:1,NAND:74,bytes:518};
 }
 const tx={from:wallet,to,data,value:'0x'+value.toString(16)};
 const simulation=await r.agree('eth_call',[tx,r.block]);
 const gas=await Promise.all(c.rpc.map(url=>r.rpc(url,'eth_estimateGas',[tx])));
 console.log(JSON.stringify({stage,chainId:196,block:r.block,blockHash:r.blockHash,decoded,transaction:tx,valueOKB:okb(value),gasEstimates:gas,simulation,warning:'UNSIGNED ONLY. Check target, chain, decoded fields and value in your wallet. Fees may change; regenerate immediately before signing. Simulation does not confirm deployment.'},null,2));
}
