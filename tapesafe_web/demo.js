(function(root) {
  function evaluate(hex, bits) {
    if (!/^0x(?:[a-f0-9]{14})+$/i.test(hex)) throw new Error('Invalid NAND netlist');
    const bytes = hex.slice(2).match(/../g).map(x => parseInt(x,16));
    const wires = [0,1,...Array.from({length:19},(_,i)=>(bits>>>i)&1)];
    const gates = [];
    for(let p=0;p<bytes.length;p+=7) {
      if(bytes[p]!==0) throw new Error('Only NAND supported');
      const a=bytes[p+1]*65536+bytes[p+2]*256+bytes[p+3];
      const b=bytes[p+4]*65536+bytes[p+5]*256+bytes[p+6];
      if(a>=wires.length||b>=wires.length) throw new Error('Invalid wire');
      const out=1-(wires[a]&wires[b]); wires.push(out); gates.push(out);
    }
    return {output:wires.at(-1),gates};
  }
  function reference(bits) {
    const approvals=bits&31, proposer=(bits>>>5)&31, must=(bits>>>10)&31;
    const effective=approvals&~proposer&31, threshold=(bits>>>15)&7;
    return !(bits&(1<<18)) && threshold>0 && effective.toString(2).replace(/0/g,'').length>=threshold && (effective&must)===must ? 1 : 0;
  }
  function packed(bits) { return '0x'+[bits&255,(bits>>>8)&255,(bits>>>16)&255].map(n=>n.toString(16).padStart(2,'0')).join(''); }
  function render(app) {
    let approvals=6, proposer=0, threshold=2, must=0, frozen=false, count=3;
    function draw(){
      const bits=approvals|(1<<(5+proposer))|(must<<10)|(threshold<<15)|(Number(frozen)<<18);
      const {output,gates}=evaluate(root.TAPE_POLICY.hex,bits);
      app.innerHTML=`<section class="hero"><div><p class="eyebrow">CIRCUIT LAB · OFFLINE</p><h2>看见每个门，<br>验证每次决策。</h2><p class="lede">运行与合约测试相同的 518 字节 NAND 网表。这里的交互不发送交易、不代表主网部署。</p></div><div class="decision ${output?'pass':'reject'}" role="status"><span>电路输出</span><strong>${output}</strong><span>${output?'规则通过 · 允许 CALL':'规则拒绝 · 阻止放款'}</span></div></section>
      <section class="card"><div class="lab-heading"><img src="img/approval-tokens.png" alt="审批节点概念图"><div><h3>把规则变成可见的结果</h3><p>选择场景，或调整成员条件。所有开关实时执行 NAND 网表。</p></div></div><div class="row">${['两票放行','单票拒绝','自批无效','紧急冻结','缺少必签'].map((x,i)=>`<button class="ghost" data-case="${i}">${x}</button>`).join('')}</div>
      <div class="lab-controls"><label><span>成员数</span><select id="demo-count">${[3,4,5].map(n=>`<option ${n===count?'selected':''}>${n}</option>`).join('')}</select></label><label><span>最低有效票数</span><select id="demo-threshold">${Array.from({length:count-1},(_,i)=>i+1).map(n=>`<option ${n===threshold?'selected':''}>${n}</option>`).join('')}</select></label><label><span>发起人（不计票）</span><select id="demo-proposer">${Array.from({length:count},(_,i)=>`<option value="${i}" ${i===proposer?'selected':''}>成员 ${String.fromCharCode(65+i)}</option>`).join('')}</select></label></div>
      <div class="signer-grid">${Array.from({length:count},(_,i)=>`<article class="signer"><strong>成员 ${String.fromCharCode(65+i)}</strong><p class="muted">${i===proposer?'发起人 · 票被屏蔽':'审批成员'}</p><label><input type="checkbox" data-vote="${i}" ${approvals&(1<<i)?'checked':''}> 已批准</label><label><input type="checkbox" data-must="${i}" ${must&(1<<i)?'checked':''}> 必签</label></article>`).join('')}</div>
      <label class="row"><input id="demo-freeze" type="checkbox" ${frozen?'checked':''}> 紧急冻结</label>
      <p class="hash">19-bit → ${packed(bits)} → ${output?'0x01':'0x00'}</p><p class="muted">发起人与必签人重叠时，本提案无法通过；请选择其他成员发起。</p></section>
      <section class="card"><h2>74 个 NAND · 实时信号</h2><div class="gates">${gates.map((v,i)=>`<span title="NAND ${i+1} 输出 ${v}" class="gate ${v?'high':''}">${String(i+1).padStart(2,'0')}</span>`).join('')}</div><p class="muted">绿色 = 输出 1；灰色 = 输出 0。末门输出与独立参考规则${output===reference(bits)?'一致':'不一致'}。完整 524,288 组输入由自动化测试穷举验证。</p></section>`;
      app.querySelectorAll('[data-vote]').forEach(el=>el.onchange=()=>{approvals^=1<<Number(el.dataset.vote);draw();});
      app.querySelectorAll('[data-must]').forEach(el=>el.onchange=()=>{must^=1<<Number(el.dataset.must);draw();});
      app.querySelector('#demo-count').onchange=e=>{count=Number(e.target.value);approvals&=(1<<count)-1;must&=(1<<count)-1;proposer=Math.min(proposer,count-1);threshold=Math.min(threshold,count-1);draw();};
      app.querySelector('#demo-threshold').onchange=e=>{threshold=Number(e.target.value);draw();};
      app.querySelector('#demo-proposer').onchange=e=>{proposer=Number(e.target.value);draw();};
      app.querySelector('#demo-freeze').onchange=e=>{frozen=e.target.checked;draw();};
      app.querySelectorAll('[data-case]').forEach(el=>el.onclick=()=>{count=3;proposer=0;threshold=2;must=0;frozen=false;approvals=6;switch(Number(el.dataset.case)){case 1:approvals=2;break;case 2:approvals=3;break;case 3:frozen=true;break;case 4:count=4;must=8;break;}draw();});
    }
    draw();
  }
  root.TapeDemo={evaluate,reference,packed,render};
})(typeof window!=='undefined'?window:globalThis);
