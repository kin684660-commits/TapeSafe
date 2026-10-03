(async function(){
 const $=id=>document.getElementById(id),A=window.ABI,D=window.DeployCore,P=D.P,c=window.TAPESAFE;
 const factory=c.factory,storeKey='tapesafe-deployment-v1';
 let provider,account='',prepared=null,busy=false;
 let saved={};try{saved=JSON.parse(localStorage.getItem(storeKey)||'{}');}catch{}
 const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const status=s=>$('status').textContent=s;
 function save(){localStorage.setItem(storeKey,JSON.stringify(saved));draw();}
 function draw(){
  $('result').textContent=JSON.stringify(saved,null,2);
  const active=!!account&&!busy&&!saved.pending&&(!saved.wallet||saved.wallet.toLowerCase()===account.toLowerCase());
  $('create').disabled=!active||!!saved.create;
  $('mint').disabled=!active||!saved.create||!!saved.mint;
  $('tapeout').disabled=!active||!saved.mint||!!saved.tapeout;
  $('resume').disabled=!account||busy||!saved.pending;
  $('sign').disabled=busy||!prepared;
 }
 const req=(method,params=[])=>provider.request({method,params});
 async function identity(){if(!provider)throw new Error('请连接钱包');if(BigInt(await req('eth_chainId'))!==196n)throw new Error('钱包必须在 X Layer 196');const accounts=await req('eth_accounts');if(accounts[0]?.toLowerCase()!==account.toLowerCase())throw new Error('账户已变更，请重新连接');if(saved.wallet&&saved.wallet.toLowerCase()!==account.toLowerCase())throw new Error('请连接之前部署的同一个钱包');}
 const call=(to,data,block='latest')=>req('eth_call',[{to,data},block]);
 async function code(address,block='latest'){if(!/^0x[0-9a-fA-F]{40}$/.test(address)||await req('eth_getCode',[address,block])==='0x')throw new Error('合约地址无代码：'+address);}
 async function connect(){
  const candidates=window.ethereum?.providers||[];
  provider=candidates.find(p=>p.isOkxWallet||p.isOKExWallet)||window.okxwallet?.ethereum||window.okxwallet||window.ethereum;
  if(!provider?.request)throw new Error('未检测到钱包扩展。请在安装并启用钱包的浏览器打开此页面。');
  await req('eth_requestAccounts');
  if(BigInt(await req('eth_chainId'))!==196n)await req('wallet_switchEthereumChain',[{chainId:'0xc4'}]);
  account=(await req('eth_accounts'))[0]||'';await identity();
  $('account').textContent=account;status('钱包已连接。请准备下一笔交易。');draw();
 }
 async function prepare(stage){
  await identity();if(saved.pending)throw new Error('已有待确认交易，先检查结果');
  busy=true;prepared=null;$('review').hidden=true;draw();status('读取费用并模拟…');
  try{
   const block=await req('eth_blockNumber');let to,data,value,expected={},label;
   await code(factory,block);
   if(stage==='create'){
    to=factory;data=D.create();value=BigInt(await call(to,'0x'+P.fee,block));
    const index=A.decodeUint(await call(factory,'0x'+P.count,block));expected.index=String(index);label='创建 TapeSafe：供应上限 210000，单价 0.000066 OKB';
   }else{
    if(!saved.create)throw new Error('请先创建处理器');
    const registered=A.decodeAddress(await call(factory,A.encode('0x'+P.at,['uint256'],[saved.create.cpuIndex]),block));
    if(registered.toLowerCase()!==saved.create.circuits.toLowerCase())throw new Error('工厂登记与记录不一致');
    if(stage==='mint'){
     to=saved.create.transistors;data=D.mint();await code(to,block);
     const price=BigInt(await call(to,'0x'+P.price,block));if(price!==66000000000000n)throw new Error('该处理器单价与约定的0.000066不符，停止以避免错误费用');
     value=price*74n+BigInt(await call(to,'0x'+P.mintFee,block));label='铸造 NAND（token ID 0），数量 74';
    }else{
     if(!saved.mint)throw new Error('请先铸造');to=saved.create.circuits;data=D.tapeout();await code(to,block);
     value=BigInt(await call(to,'0x'+P.tapeFee,block));label='流片 tapesafe_policy：19 输入 / 1 输出 / 74 NAND';
    }
   }
   const tx={from:account,to,data,value:'0x'+value.toString(16)};
   const simulation=await req('eth_call',[tx,block]);
   if(stage==='create'){
    const bytes=A.hexToBytes(simulation);if(bytes.length!==64)throw new Error('创建模拟返回格式异常');
    expected.transistors=A.decodeAddress('0x'+A.hex(bytes.slice(0,32)));expected.circuits=A.decodeAddress('0x'+A.hex(bytes.slice(32,64)));
   }
   if(stage==='tapeout')expected.ruleId=String(A.decodeUint(simulation));
   const gas=BigInt(await req('eth_estimateGas',[tx])),gasPrice=BigInt(await req('eth_gasPrice'));
   const balance=BigInt(await req('eth_getBalance',[account,'latest']));if(balance<value+gas*gasPrice)throw new Error('余额不足以支付协议费和预计 gas');
   prepared={stage,tx,expected,label};
   $('summary').innerHTML=`<p>${esc(label)}</p><p>协议付款：<strong>${D.okb(value)} OKB</strong></p><p>预计 gas：${D.okb(gas*gasPrice)} OKB（钱包可能调整）</p><p>目标地址：</p><div class="hash">${esc(to)}</div><p>模拟已通过。签名前在钱包核对网络、目标和付款。</p>`;
   $('review').hidden=false;status('准备完成，等待你打开钱包核对并签名。');
  }finally{busy=false;draw();}
 }
 async function receiptFor(hash){for(let i=0;i<60;i++){const r=await req('eth_getTransactionReceipt',[hash]);if(r)return r;await new Promise(resolve=>setTimeout(resolve,2000));}return null;}
 async function finish(){
  await identity();const pending=saved.pending;if(!pending)throw new Error('没有待检查交易');
  status('等待交易收据，请勿重复发送…');const receipt=await receiptFor(pending.hash);
  if(!receipt){status('交易尚未确认。稍后点击“继续检查已发送交易”。');return;}
  if(BigInt(receipt.status)!==1n){saved.failed={...pending,receipt};delete saved.pending;save();throw new Error('交易失败，已保留记录；请导出记录并检查交易收据');}
  const tx=await req('eth_getTransactionByHash',[pending.hash]);
  if(!tx||tx.from.toLowerCase()!==account.toLowerCase()||tx.to.toLowerCase()!==pending.tx.to.toLowerCase()||tx.input.toLowerCase()!==pending.tx.data.toLowerCase()||BigInt(tx.value)!==BigInt(pending.tx.value))throw new Error('交易内容与准备记录不符，停止自动处理');
  const block=receipt.blockNumber,result={transaction:pending.hash,blockNumber:block};
  if(pending.stage==='create'){
   const e=pending.expected;
   const registered=A.decodeAddress(await call(factory,A.encode('0x'+P.at,['uint256'],[e.index]),block));
   if(registered.toLowerCase()!==e.circuits.toLowerCase())throw new Error('创建成功但模拟地址与实际工厂登记不一致。请勿重复创建；导出记录并核对收据中的实际部署地址。');
   await code(e.circuits,block);await code(e.transistors,block);
   const emitters=new Set(receipt.logs.map(log=>log.address.toLowerCase()));
   if(!emitters.has(e.circuits.toLowerCase())||!emitters.has(e.transistors.toLowerCase()))throw new Error('创建收据未证明模拟的两合约均产生事件，需人工核对');
   Object.assign(result,{cpuIndex:e.index,transistors:e.transistors,circuits:e.circuits});
  }else if(pending.stage==='tapeout'){
   const topic='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
   const mint=receipt.logs.find(log=>log.address.toLowerCase()===saved.create.circuits.toLowerCase()&&log.topics[0]===topic&&log.topics.length===4&&BigInt(log.topics[1])===0n);
   if(!mint)throw new Error('流片收据中未找到电路铸造事件');result.ruleId=String(BigInt(mint.topics[3]));
   const info=A.hexToBytes(await call(saved.create.circuits,A.encode(A.SEL.circuitInfo,['uint256'],[result.ruleId]),block));
   const dims=[0,32,64,96].map(i=>Number(A.u256At(info,i)));if(JSON.stringify(dims)!=='[19,1,0,74]')throw new Error('电路规格不符');result.circuitInfo=dims;
   result.vectors={};for(const [input,want] of [['0x260001','01'],['0x260005','00']]){const out=await call(saved.create.circuits,A.encode('0x'+P.eval,['uint256','bytes'],[result.ruleId,input]),block);const value=A.hex(A.readBytes(A.hexToBytes(out),0));if(value!==want)throw new Error('电路求值不符');result.vectors[input]='0x'+value;}
  }
  saved[pending.stage]=result;delete saved.pending;save();status(pending.stage==='tapeout'?'部署已完成。可下载部署记录并运行独立链上核验。':'交易成功并已核对，请准备下一步。');
 }
 async function sign(){
  await identity();const p=prepared;if(!p||busy||saved.pending)throw new Error('请先准备交易');
  prepared=null;busy=true;draw();
  try{
   await req('eth_call',[p.tx,'latest']);
   if(p.stage==='create'&&String(A.decodeUint(await call(factory,'0x'+P.count)))!==p.expected.index)throw new Error('工厂状态已变化，请重新准备');
   status('请在钱包核对并确认。这会发送付费交易。');
   const hash=await req('eth_sendTransaction',[p.tx]);
   saved.wallet=account;saved.chainId=196;saved.pending={...p,hash};save();$('review').hidden=true;await finish();
  }finally{busy=false;draw();}
 }
 function on(id,fn){$(id).onclick=()=>Promise.resolve().then(fn).catch(error=>status(error.message||String(error)));}
 on('connect',connect);on('create',()=>prepare('create'));on('mint',()=>prepare('mint'));on('tapeout',()=>prepare('tapeout'));on('sign',sign);
 on('resume',async()=>{if(busy)return;busy=true;draw();try{await finish();}finally{busy=false;draw();}});
 on('export',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='tapesafe-deployment.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 draw();
})();
