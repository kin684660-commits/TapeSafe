import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {A,P,config,address,netlist,tapeData,createData,client} from './protocol.mjs';
if(process.argv.includes('--vault')){await import('./verify-vault.mjs');}else{
 const c=config(),r=await client(c),checks={};
 for(const k of ['transistors','circuits'])checks[k+'CodeBytes']=await r.code(address(c[k],k));
 if(!/^[1-9]\d*$/.test(String(c.ruleId)))throw new Error('Set actual ruleId');
 const raw=A.hexToBytes(await r.call(c.circuits,A.encode(A.SEL.circuitInfo,['uint256'],[c.ruleId])));
 checks.circuitInfo=[0,32,64,96].map(i=>Number(A.u256At(raw,i)));
 if(JSON.stringify(checks.circuitInfo)!=='[19,1,0,74]')throw new Error('Circuit is not 19/1/0/74');
 checks.vectors={};
 for(const [input,want] of [['0x260001','01'],['0x260005','00'],['0x220001','00'],['0x230001','00']]){
  const value=await r.call(c.circuits,A.encode('0x'+P.eval,['uint256','bytes'],[c.ruleId,input]));
  const output=A.hex(A.readBytes(A.hexToBytes(value),0));if(output!==want)throw new Error(`eval ${input} != ${want}`);checks.vectors[input]='0x'+output;
 }
 if(!/^\d+$/.test(String(c.cpuIndex)))throw new Error('Fill cpuIndex to verify factory registration');
 const registered=A.decodeAddress(await r.call(c.factory,A.encode('0x'+P.cpuAt,['uint256'],[c.cpuIndex])));
 if(registered.toLowerCase()!==c.circuits.toLowerCase())throw new Error('Factory cpuAt does not match circuits');checks.factoryRegistration=true;
 const owner=A.decodeAddress(await r.call(c.circuits,A.encode(A.SEL.ownerOf,['uint256'],[c.ruleId])));
 checks.nftOwner=owner;
 if(owner.toLowerCase()!==address(c.deployer,'deployer').toLowerCase())throw new Error('NFT owner differs from deployment wallet');
 const plan=JSON.parse(readFileSync(new URL('../deployment/plan.json',import.meta.url),'utf8'));
 checks.deploymentTransactions={};
 for(const [name,hash,target,input] of [['create',c.createTx,c.factory,createData(plan)],['mint',c.mintTx,c.transistors,A.encode('0x'+P.mint,['uint256','uint256'],[0,74])]]){
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Missing '+name+' transaction');
  const [tx,receipt]=await Promise.all([r.agree('eth_getTransactionByHash',[hash]),r.agree('eth_getTransactionReceipt',[hash])]);
  if(!tx||!receipt||BigInt(receipt.status)!==1n||tx.to?.toLowerCase()!==target.toLowerCase()||tx.from?.toLowerCase()!==c.deployer.toLowerCase()||tx.input.toLowerCase()!==input.toLowerCase())throw new Error(name+' transaction mismatch');
  if(BigInt(receipt.blockNumber)>BigInt(r.block))throw new Error('Receipt newer than snapshot');
  const header=await r.agree('eth_getBlockByNumber',[receipt.blockNumber,false]);
  if(header.hash!==receipt.blockHash)throw new Error('Noncanonical receipt');
  if(name==='create'){
   const found=receipt.logs.some(log=>log.address.toLowerCase()===c.factory.toLowerCase()&&log.topics[0]==='0x2e8868f18a1eaf0222b5b09484fdf12163e9741393f8457cd79d2ae42b2d2290'&&log.topics.length===4&&A.decodeAddress(log.topics[1]).toLowerCase()===c.circuits.toLowerCase()&&A.decodeAddress(log.topics[2]).toLowerCase()===c.transistors.toLowerCase()&&A.decodeAddress(log.topics[3]).toLowerCase()===c.deployer.toLowerCase());
   if(!found)throw new Error('createCPU factory pairing mismatch');
   checks.factoryPairingAndDeployer=true;
  }
  checks.deploymentTransactions[name]={hash,blockNumber:receipt.blockNumber,status:'success'};
 }
 checks.mintPriceWei=A.decodeUint(await r.call(c.transistors,'0x'+P.price)).toString();
 if(checks.mintPriceWei!==plan.mintPriceWei)throw new Error('Mint price differs from approved plan');
 const arg=process.argv.indexOf('--tapeout-tx');if(arg<0)throw new Error('Include --tapeout-tx 0xHASH to verify actual on-chain bytes and minted Circuit ID');
 const hash=process.argv[arg+1];if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Invalid transaction hash');
 const [tx,receipt]=await Promise.all([r.agree('eth_getTransactionByHash',[hash]),r.agree('eth_getTransactionReceipt',[hash])]);
 if(!tx||!receipt||BigInt(receipt.status)!==1n||tx.to?.toLowerCase()!==c.circuits.toLowerCase()||tx.from?.toLowerCase()!==c.deployer.toLowerCase()||tx.input.toLowerCase()!==tapeData())throw new Error('Tapeout receipt/target/netlist mismatch');
 if(BigInt(receipt.blockNumber)>BigInt(r.block))throw new Error('Receipt newer than snapshot; wait and retry');
 const canonical=await r.agree('eth_getBlockByNumber',[receipt.blockNumber,false]);if(canonical.hash!==receipt.blockHash)throw new Error('Receipt block is not canonical');
 const minted=receipt.logs.some(log=>log.address.toLowerCase()===c.circuits.toLowerCase()&&log.topics[0]==='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'&&log.topics.length===4&&BigInt(log.topics[1])===0n&&BigInt(log.topics[3])===BigInt(c.ruleId));
 if(!minted)throw new Error('Receipt does not mint configured Circuit ID');
 checks.tapeoutTransaction=hash;checks.netlistBytesMatch=true;checks.mintedCircuitIdMatches=true;
 console.log(JSON.stringify({mode:'processor-and-circuit',verifiedAt:new Date().toISOString(),chainId:196,block:r.block,blockHash:r.blockHash,processor:c.transistors,circuits:c.circuits,ruleId:c.ruleId,cpuIndex:c.cpuIndex,sha256:createHash('sha256').update(Buffer.from(netlist().slice(2),'hex')).digest('hex'),checks,limitations:['No vault or executor is claimed deployed.','Sample eval vectors are not a complete proof of chain behavior; protocol remains upgradeable.']},null,2));
}
