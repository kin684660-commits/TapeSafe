(function () {
  const CFG = window.TAPESAFE;
  const ABI = window.ABI;
  const S = ABI.SEL;
  const ready = [CFG.module, CFG.circuits, CFG.container].every(x => /^0x[0-9a-fA-F]{40}$/.test(x) && !/^0x0{40}$/.test(x));
  let snapshot = "latest";
  let previewed = null;
  let routeEpoch = 0;

  const routes = [
    ["#/", "总览"],
    ["#/demo", "电路实验室"],
    ...(ready ? [["#/new", "发起"], ["#/log", "审计"]] : []),
    ["#/verify", "链上核验"],
    ["#/about", "说明"],
  ];

  let account = "";
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function short(addr) {
    if (!addr) return "—";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  function okb(wei) {
    const n = BigInt(wei || 0);
    const whole = n / 10n ** 18n;
    const frac = (n % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
    return `${whole}.${frac} OKB`;
  }

  function drawNav() {
    const here = location.hash.split("?")[0] || "#/";
    nav.innerHTML = routes.map(([href, label]) => {
      const active = here === href || (href !== "#/" && here.startsWith(href)) || (href === "#/" && here.startsWith("#/p/")) ? " on" : "";
      return `<a class="${active}" href="${href}">${label}</a>`;
    }).join("");
  }

  async function rpc(url, method, params) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(body.error.message || "rpc");
    if (body.result === undefined) throw new Error("RPC 返回缺少 result");
    return body.result;
  }

  async function call(to, data) {
    const results = await Promise.all(CFG.rpc.map((url) => rpc(url, "eth_call", [{ to, data }, snapshot])));
    if (results[0] !== results[1]) throw new Error("OKX 和 dRPC 的读数不一致，已停止，不发送交易。");
    return results[0];
  }

  async function balance(address) {
    const results = await Promise.all(CFG.rpc.map((url) => rpc(url, "eth_getBalance", [address, snapshot])));
    if (results[0] !== results[1]) throw new Error("余额读数不一致。");
    return BigInt(results[0]);
  }

  async function connect() {
    const eth = window.ethereum;
    if (!eth) { app.insertAdjacentHTML("afterbegin", `<p class="banner">没有检测到钱包。</p>`); return; }
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    if (!accounts[0]) throw new Error("钱包未提供账户。");
    const chain = await eth.request({ method: "eth_chainId" });
    if (chain !== CFG.chainHex) {
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CFG.chainHex }] });
      } catch (error) {
        if (error.code === 4902) {
          await eth.request({ method: "wallet_addEthereumChain", params: [{
            chainId: CFG.chainHex,
            chainName: CFG.chainName,
            nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
            rpcUrls: CFG.rpc,
            blockExplorerUrls: [CFG.explorer],
          }] });
        } else throw error;
      }
    }
    const verifiedChain = await eth.request({ method: "eth_chainId" });
    if (BigInt(verifiedChain) !== BigInt(CFG.chainId)) throw new Error("请在钱包切换到 X Layer 后重新连接。");
    account = (await eth.request({ method: "eth_accounts" }))[0] || "";
    if (!account) throw new Error("钱包连接已取消。");
    document.getElementById("connect").textContent = short(account);
    render();
  }

  async function send(to, data, value) {
    if (!ready || !account || !window.ethereum) throw new Error("请先配置合约并连接钱包。");
    const active = await window.ethereum.request({ method: "eth_accounts" });
    if (active[0]?.toLowerCase() !== account.toLowerCase()) throw new Error("钱包账户已改变，请重新连接。");
    const chain = await window.ethereum.request({ method: "eth_chainId" });
    if (chain !== CFG.chainHex) throw new Error("钱包不在 X Layer（196）。");
    await pinBlock();
    for (const address of [CFG.module, CFG.circuits, CFG.container]) {
      const codes = await Promise.all(CFG.rpc.map(url => rpc(url, "eth_getCode", [address, snapshot])));
      if (codes.some(x => x === "0x" || x !== codes[0])) throw new Error("合约代码不存在或 RPC 代码不一致。");
    }
    for (const key of ["circuits", "container"]) {
      const bound = ABI.decodeAddress(await call(CFG.module, S[key]));
      if (bound.toLowerCase() !== CFG[key].toLowerCase()) throw new Error("页面配置与执行器绑定不一致。");
    }
    for (const key of ["ruleId", "vaultId"]) {
      if (ABI.decodeUint(await call(CFG.module, S[key])) !== BigInt(CFG[key])) throw new Error("页面电路 ID 与执行器绑定不一致。");
    }
    const tx = { from: account, to, data, value: "0x" + BigInt(value || 0).toString(16) };
    const checks = await Promise.all(CFG.rpc.map(url => rpc(url, "eth_call", [tx, snapshot])));
    if (checks[0] !== checks[1]) throw new Error("交易模拟结果不一致，已停止。");
    return window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to, data, value: value ? "0x" + BigInt(value).toString(16) : "0x0" }],
    });
  }

  function whyBody() {
    return `<section class="card"><h2>把审批规则变成可验证的电路</h2>
    <p>一名成员发起，其他成员批准。执行器将批准位、发起人、必签人、门槛和冻结位编码为 19 位输入。74 个 NAND 输出 1，才允许金库执行 CALL。</p>
    <div class="row"><a class="chip" href="#/demo">打开电路实验室 →</a><a class="chip" href="#/verify">查看链上核验清单 →</a></div>
    <p class="muted">当前 ${ready ? "已配置链上地址，仍需核验" : "为电路演示模式；执行器未配置，处理器与电路见链上核验页"}。DeWEB 是可选扩展；本地网页不具备链上完整性保证。</p></section>`;
  }

  function waitCard() {
    return `<section class="card"><p class="muted">本次提交只部署处理器与电路，金库功能未启用。先看<a href="#/">总览</a>和<a href="#/about">说明</a>，了解它保护的是哪一步。</p></section>`;
  }

  function hero() {
    return `<section class="hero landing-hero">
      <div><p class="eyebrow">VERIFIABLE APPROVAL / X LAYER</p>
        <h2>信任团队。<br><span>验证每次决策。</span></h2>
        <p class="lede">把团队审批规则刻进 74 个逻辑门。发起人不计票，必签人不能缺席，紧急冻结立即阻断。每个结果，都有可重放的依据。</p>
        <div class="hero-actions"><a class="button primary" href="#/demo">体验审批电路 <span>↗</span></a><a class="button ghost" href="#/verify">核验主网部署 →</a></div>
        <div class="chips"><span class="chip status-dot">X Layer · 电路已部署</span><span class="chip">CPU #267 / Circuit #1</span></div>
      </div>
      <figure class="wafer"><img src="img/processor-hero.png" alt="铜色线路汇入薄荷绿芯片核心的概念图"><figcaption>POLICY ENGINE <span>74 NAND / 19 → 1</span></figcaption></figure>
    </section>`;
  }

  function productBody() {
    return `<section class="metric-strip" aria-label="电路规格"><div><strong>74</strong><span>NAND 逻辑门</span></div><div><strong>19 → 1</strong><span>输入位 → 决策位</span></div><div><strong>524,288</strong><span>本地穷举输入</span></div><div><strong>196</strong><span>X Layer Chain ID</span></div></section>
    <section class="section-heading"><p class="eyebrow">RULES YOU CAN REPLAY</p><h2>审批的边界，清晰可见。</h2><p class="muted">不靠界面上的绿色勾选。用同一份 NAND 网表计算结果。</p></section>
    <section class="feature-grid"><article class="feature-card"><img src="img/approval-tokens.png" alt="分离的审批节点连向逻辑门" loading="lazy"><div><span class="k">01 / COLLECTIVE APPROVAL</span><h3>发起不等于批准</h3><p>屏蔽发起人的票，再检查最低票数和必签成员。少一个条件，输出就是 0。</p><a href="#/demo">试试自批无效 →</a></div></article>
    <article class="feature-card"><img src="img/freeze-core.png" alt="隔离屏障包围芯片核心的概念图" loading="lazy"><div><span class="k">02 / EMERGENCY FREEZE</span><h3>在危险发生前停止</h3><p>冻结位具有最高优先级。即使其他审批条件全部满足，电路依然拒绝。</p><a href="#/demo">试试紧急冻结 →</a></div></article></section>
    <section class="flow-card"><div><p class="eyebrow">FROM INTENT TO EVIDENCE</p><h2>一条可以公开复核的路径。</h2></div><ol><li><b>01</b><strong>输入审批条件</strong><span>成员、门槛、必签与冻结</span></li><li><b>02</b><strong>执行 74 个 NAND</strong><span>518 字节真实流片网表</span></li><li><b>03</b><strong>读取 0 或 1</strong><span>浏览器重放与链上 eval 对照</span></li></ol></section>
    <section class="card proof-callout"><div><p class="eyebrow">LIVE ON X LAYER</p><h2>让证据替产品说话。</h2><p class="muted">创建、铸造、流片三笔交易已核对。主网展示范围为处理器与规则电路；金库执行器本次未部署。</p></div><a class="button primary" href="#/verify">打开核验台 ↗</a></section>`;
  }

  async function overview(epoch) {
    if (!ready) { app.innerHTML = hero() + productBody(); return; }
    app.innerHTML = `<p class="muted">正在从两条 RPC 读取…</p>`;
    try {
      const [custody, threshold, must, frozen, nonce, count, bal, info] = await Promise.all([
        call(CFG.module, S.custodyOk),
        call(CFG.module, S.threshold),
        call(CFG.module, S.mustMask),
        call(CFG.module, S.frozen),
        call(CFG.module, S.configNonce),
        call(CFG.module, S.signerCount),
        balance(CFG.container),
        call(CFG.circuits, ABI.encode(S.circuitInfo, ["uint256"], [CFG.ruleId])),
      ]);
      const n = Number(ABI.decodeUint(count));
      const signers = [];
      for (let i = 0; i < n; i++) signers.push(ABI.decodeAddress(await call(CFG.module, ABI.encode(S.signers, ["uint256"], [i]))));
      const words = ABI.hexToBytes(info);
      const gates = ABI.u256At(words, 96);
      const held = ABI.decodeUint(custody) === 1n;
      if (epoch !== routeEpoch) return;
      app.innerHTML = `<section class="grid">
        <div class="card"><div class="k">金库</div><div class="v">${okb(bal)}</div><div class="muted">${esc(short(CFG.container))}</div></div>
        <div class="card"><div class="k">托管</div><div class="v ${held ? "ok" : "bad"}">${held ? "NFT 在执行器里" : "NFT 还没转入"}</div></div>
        <div class="card"><div class="k">门槛</div><div class="v">${Number(ABI.decodeUint(threshold))} / ${n}</div><div class="muted">必签掩码 ${Number(ABI.decodeUint(must))}</div></div>
        <div class="card"><div class="k">冻结</div><div class="v ${ABI.decodeUint(frozen) === 1n ? "bad" : "ok"}">${ABI.decodeUint(frozen) === 1n ? "已冻结" : "正常"}</div><div class="muted">nonce ${ABI.decodeUint(nonce)}</div></div>
      </section>
      <section class="card"><div class="k">签名人</div>${signers.map((s, i) => `<div>${i} · ${esc(s)}</div>`).join("")}
        <p class="muted">规则电路 #${esc(CFG.ruleId)} · ${gates} 门。执行只走 CALL，不走 delegatecall。</p>
        <button id="freeze" class="danger" type="button">一键冻结</button></section>`;
      document.getElementById("freeze").onclick = () => send(CFG.module, S.freeze, 0).then(showTx).catch(showErr);
    } catch (error) { if (epoch === routeEpoch) app.innerHTML = `<p class="banner">${esc(error.message)}</p>`; }
  }

  function form() {
    if (!ready) { app.innerHTML = waitCard(); return; }
    app.innerHTML = `<section class="card"><h2>发起提案</h2>
      <label><span>提案类型</span><select id="kind"><option value="transfer">转账 / 合约调用</option><option value="thaw">解除冻结</option><option value="signers">更新签名人</option><option value="site">前端上传授权（可选 DeWEB）</option></select></label>
      <div id="transferFields">
      <label><span>收款地址</span><input id="to" placeholder="0x"></label>
      <label><span>金额（OKB）</span><input id="value" placeholder="0"></label>
      <label><span>calldata（可选，ERC-20 转账填在这里，金额改 0）</span><input id="data" value="0x"></label>
      </div><div id="configFields" hidden>
      <label><span>新签名人（逗号分隔，2–5 人）</span><textarea id="newSigners"></textarea></label>
      <label><span>新门槛（必须小于人数）</span><input id="newThreshold" value="2"></label>
      <label><span>必签位掩码（默认 0）</span><input id="newMust" value="0"></label></div>
      <div id="siteFields" hidden><label><span>上传授权地址</span><input id="operator"></label><label><span>授权秒数（最多 2592000）</span><input id="ttl" value="3600"></label></div>
      <label><span>有效期（小时）</span><input id="hours" value="24"></label>
      <button id="preview" class="ghost" type="button">预览链上哈希</button>
      <button id="submit" class="primary" type="button">发起</button>
      <div id="previewBox"></div>
      <p class="muted">钱包里签的是链上重新算出来的提案哈希。发起人自己的票，电路会屏蔽。</p></section>`;
    previewed = null;
    app.querySelectorAll("input,textarea,select").forEach(input => input.addEventListener("input", () => { previewed = null; }));
    document.getElementById("kind").onchange = e => {
      document.getElementById("transferFields").hidden = e.target.value !== "transfer";
      document.getElementById("configFields").hidden = e.target.value !== "signers";
      document.getElementById("siteFields").hidden = e.target.value !== "site";
      previewed = null;
    };
    document.getElementById("preview").onclick = preview;
    document.getElementById("submit").onclick = submitProposal;
  }

  function proposalArgs() {
    const selected = document.getElementById("kind").value;
    const hours = Number(document.getElementById("hours").value);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 720) throw new Error("有效期应为 0–720 小时（不含 0）。");
    const deadline = Math.floor(Date.now() / 1000 + hours * 3600);
    if (selected === "thaw") return { kind: 1, to: CFG.module, value: 0n, data: S.applyUnfreeze, deadline };
    if (selected === "signers") {
      const people = document.getElementById("newSigners").value.split(",").map(x=>x.trim());
      const threshold = Number(document.getElementById("newThreshold").value);
      const must = Number(document.getElementById("newMust").value);
      if (people.length < 2 || people.length > 5 || new Set(people.map(x=>x.toLowerCase())).size !== people.length || people.some(x=>!/^0x[0-9a-fA-F]{40}$/.test(x)||/^0x0{40}$/.test(x))) throw new Error("需填写 2–5 个不重复的非零地址。");
      if (!Number.isInteger(threshold) || threshold < 1 || threshold >= people.length || !Number.isInteger(must) || must < 0 || must >= (1<<people.length)-1) throw new Error("门槛或必签掩码不可满足。");
      return { kind: 1, to: CFG.module, value: 0n, data: ABI.encode(S.applySigners,["address[]","uint8","uint8"],[people,threshold,must]), deadline };
    }
    if (selected === "site") {
      const to = document.getElementById("operator").value.trim();
      const ttl = Number(document.getElementById("ttl").value);
      if (!/^0x[0-9a-fA-F]{40}$/.test(to) || /^0x0{40}$/.test(to) || !Number.isInteger(ttl) || ttl<1 || ttl>2592000) throw new Error("授权地址或时长不合法。");
      return {kind:2, to, value:BigInt(ttl), data:"0x", deadline};
    }
    const to = document.getElementById("to").value.trim();
    const okbText = document.getElementById("value").value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(to) || /^0x0{40}$/.test(to)) throw new Error("请填写有效非零地址。");
    if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(okbText)) throw new Error("金额必须为非负十进制，最多 18 位小数。");
    const [whole, frac = ""] = okbText.split(".");
    const value = BigInt(whole) * 10n ** 18n + BigInt(frac.padEnd(18, "0"));
    const data = document.getElementById("data").value.trim() || "0x";
    if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(data) || data.length > 8194) throw new Error("calldata 必须为偶数位十六进制，最多 4096 字节。");
    return { kind: 0, to, value, data, deadline };
  }

  async function preview() {
    const box = document.getElementById("previewBox");
    try {
      const a = proposalArgs();
      const data = ABI.encode(S.previewHash, ["uint8", "address", "uint256", "bytes", "uint64"], [a.kind, a.to, a.value, a.data, a.deadline]);
      await pinBlock();
      const hash = await call(CFG.module, data);
      previewed = { ...a, hash };
      box.innerHTML = `<p class="k">提案哈希（链上 previewHash）</p><div class="hash">${esc(hash)}</div>`;
    } catch (error) { showErr(error); }
  }

  async function submitProposal() {
    try {
      const current = proposalArgs();
      if (!previewed || ["kind", "to", "value", "data"].some(k => current[k] !== previewed[k])) throw new Error("请先预览；修改表单后需重新预览。");
      const a = previewed;
      await pinBlock();
      const hash = await call(CFG.module, ABI.encode(S.previewHash, ["uint8", "address", "uint256", "bytes", "uint64"], [a.kind, a.to, a.value, a.data, a.deadline]));
      if (hash !== a.hash) throw new Error("提案序号或配置已变化，请重新预览。");
      const data = ABI.encode(S.propose, ["uint8", "address", "uint256", "bytes", "uint64"], [a.kind, a.to, a.value, a.data, a.deadline]);
      showTx(await send(CFG.module, data, 0));
    } catch (error) { showErr(error); }
  }

  async function detail(id, epoch) {
    if (!ready) { app.innerHTML = waitCard(); return; }
    app.innerHTML = `<p class="muted">读取提案 ${esc(id)}…</p>`;
    try {
      const raw = await call(CFG.module, ABI.encode(S.proposalInfo, ["uint256"], [id]));
      const info = decodeProposal(raw);
      if (info.proposer === "0x" + "0".repeat(40)) { app.innerHTML = `<p>没有这个提案。</p>`; return; }
      const hash = await call(CFG.module, ABI.encode(S.hashOf, ["uint256"], [id]));
      const checked = await call(CFG.module, ABI.encode(S.check, ["uint256"], [id]));
      const checkBytes = ABI.hexToBytes(checked);
      const inputs = ABI.hex(ABI.readBytes(checkBytes, 0));
      const outputs = ABI.hex(ABI.readBytes(checkBytes, 32));
      const pass = ABI.u256At(checkBytes, 64) === 1n;
      const nonce = ABI.decodeUint(await call(CFG.module, S.configNonce));
      const closed = info.executed || info.cancelled || info.deadline < Date.now()/1000 || info.nonce !== nonce;
      if (epoch !== routeEpoch) return;
      app.innerHTML = `<section class="card"><div class="k">提案 #${esc(id)} · ${["转账", "配置", "前端授权"][info.kind] || info.kind}</div>
        <p>收款 <span class="hash">${esc(info.to)}</span></p>
        <p>${info.kind === 2 ? "授权时长（秒）" : "金额"} ${info.kind === 2 ? info.value : okb(info.value)}</p>
        <p>状态：${info.executed ? "已执行" : info.cancelled ? "已取消" : info.nonce !== nonce ? "配置已变更，提案失效" : Date.now()/1000 > info.deadline ? "已过期" : "待处理"} · 截止 ${new Date(info.deadline * 1000).toLocaleString()}</p>
        <p class="hash">calldata: 0x${ABI.hex(info.data)}</p>
        <p class="k">提案哈希，拿去和钱包弹窗对照</p>
        <div class="hash">${esc(hash)}</div>
        <p>电路输入 <code>0x${esc(inputs)}</code> → 输出 <code>0x${esc(outputs)}</code>
          <strong class="${pass ? "ok" : "bad"}">${pass ? "放行" : "拒绝"}</strong></p>
        <div class="row">
          <button id="approve" class="primary" type="button">批准</button>
          <button id="revoke" class="ghost" type="button">撤回我的票</button>
          <button id="exec" class="primary" type="button">执行</button>
          <button id="cancel" class="ghost" type="button">发起人取消</button>
        </div></section>`;
      for (const button of app.querySelectorAll("button")) button.disabled = closed || !account;
      document.getElementById("exec").disabled = closed || !account || !pass;
      document.getElementById("approve").onclick = () => send(CFG.module, ABI.encode(S.approve, ["uint256", "bytes32"], [id, hash]), 0).then(showTx).catch(showErr);
      document.getElementById("revoke").onclick = () => send(CFG.module, ABI.encode(S.revoke, ["uint256"], [id]), 0).then(showTx).catch(showErr);
      document.getElementById("cancel").onclick = () => send(CFG.module, ABI.encode(S.cancel, ["uint256"], [id]), 0).then(showTx).catch(showErr);
      document.getElementById("exec").onclick = async () => {
        try {
          const fee = info.kind === 0 ? ABI.decodeUint(await call(CFG.container, S.execFee)) : 0n;
          showTx(await send(CFG.module, ABI.encode(S.execute, ["uint256"], [id]), fee));
        } catch (error) { showErr(error); }
      };
    } catch (error) { if (epoch === routeEpoch) app.innerHTML = `<p class="banner">${esc(error.message)}</p>`; }
  }

  function decodeProposal(hexResult) {
    const bytes = ABI.hexToBytes(hexResult);
    const addr = (i) => "0x" + ABI.u256At(bytes, i).toString(16).padStart(40, "0");
    return {
      kind: Number(ABI.u256At(bytes, 0)),
      to: addr(32),
      value: ABI.u256At(bytes, 64),
      data: ABI.readBytes(bytes, 96),
      deadline: Number(ABI.u256At(bytes, 128)),
      proposer: addr(160),
      approvals: Number(ABI.u256At(bytes, 192)),
      executed: ABI.u256At(bytes, 224) === 1n,
      cancelled: ABI.u256At(bytes, 256) === 1n,
      thaw: ABI.u256At(bytes, 288) === 1n,
      nonce: ABI.u256At(bytes, 320),
    };
  }

  async function log(epoch) {
    if (!ready) { app.innerHTML = waitCard(); return; }
    app.innerHTML = `<p class="muted">正在读取最近提案状态…</p>`;
    try {
      const next = Number(ABI.decodeUint(await call(CFG.module, S.nextId)));
      const currentNonce = ABI.decodeUint(await call(CFG.module, S.configNonce));
      const items = [];
      for (let id = next - 1; id >= Math.max(1, next - 40); id--) {
        const info = decodeProposal(await call(CFG.module, ABI.encode(S.proposalInfo, ["uint256"], [id])));
        items.push({ id, info });
      }
      if (epoch !== routeEpoch) return;
      app.innerHTML = `<section class="card"><h2>提案状态 · 最近 40 条</h2>
        <p class="muted">每一票都是一笔交易。发起人的那一票在电路里被抹掉，所以下面的职责分离是链上规则，不是页面文案。</p>
        <div class="timeline">${items.map(({ id, info }) => {
          
          return `<article><a href="#/p/${id}">提案 #${id}</a> · ${esc(short(info.proposer))}
            · ${info.executed ? "已执行" : info.cancelled ? "已取消" : info.nonce !== currentNonce ? "已失效" : Date.now()/1000 > info.deadline ? "已过期" : "待执行"}
            <div>✔ 发起人不能自批（电路屏蔽 proposer 位）</div>
            <div>${info.executed ? "✔" : "·"} 执行前需满足当时配置，且电路输出位为 1</div>
          </article>`;
        }).join("") || "<p>还没有提案。</p>"}</div>
        <p>前端变更要先有一条「前端授权」提案。FileSet / OperatorSet 记在网站仓库 <code>${esc(CFG.siteRegistry)}</code>。</p></section>`;
    } catch (error) { if (epoch === routeEpoch) app.innerHTML = `<p class="banner">${esc(error.message)}</p>`; }
  }

  function verify() {
    const link = (kind, value) => `${CFG.explorer}/${kind}/${value}`;
    app.innerHTML = `<section class="section-heading"><p class="eyebrow">ON-CHAIN EVIDENCE</p><h2>处理器 → 电路 → 决策</h2><p class="muted">无需连接钱包。点击实时核验，在两条独立 RPC 的同一区块读取公开数据。</p></section>
      <section class="grid"><div class="card"><div class="k">PROCESSOR</div><div class="v">#${esc(CFG.cpuIndex)}</div></div><div class="card"><div class="k">CIRCUIT</div><div class="v">#${esc(CFG.ruleId)}</div></div><div class="card"><div class="k">NAND / LATCH</div><div class="v">74 / 0</div></div><div class="card"><div class="k">INPUT / OUTPUT</div><div class="v">19 / 1</div></div></section>
      <section class="card"><h3>公开部署地址</h3>${[["处理器（Transistors）",CFG.transistors],["电路合约",CFG.circuits],["部署钱包",CFG.deployer]].map(([label,address])=>`<p class="k">${label}</p><a class="hash address-link" href="${link('address',address)}" target="_blank" rel="noopener noreferrer">${esc(address)} ↗</a>`).join('')}
      <div class="chips">${[["01 创建",CFG.createTx],["02 铸造",CFG.mintTx],["03 流片",CFG.tapeoutTx]].map(([label,tx])=>`<a class="chip" href="${link('tx',tx)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`).join('')}</div><p class="muted">供应上限 210,000 · 铸造单价 0.000066 OKB · 协议费与 Gas 另付</p></section>
      <section class="card"><div class="row"><h3>实时只读核验</h3><button id="live-check" class="primary" type="button">读取链上电路</button></div><div id="live-results"><p class="muted">尚未读取。离线演示与历史核验记录不能替代本次实时结果。</p></div></section>
      <section class="card"><h3>本次展示范围</h3><p>已部署处理器和规则电路；交互实验室在浏览器执行相同网表。执行器和金库未部署，电路 eval 本身不会转账。图片仅用于表达产品概念。</p><p class="muted">未审计原型，底层协议可升级。网页本地运行，没有 DeWEB 完整性保证。</p></section>`;
    document.getElementById('live-check').onclick = liveCheck;
  }

  async function liveCheck() {
    const epoch = routeEpoch;
    const button = document.getElementById('live-check');
    const result = document.getElementById('live-results');
    button.disabled = true;
    result.innerHTML = '<p class="muted">正在固定区块并比对两个节点…</p>';
    try {
      await pinBlock();
      const block = snapshot;
      const data = await call(CFG.circuits, ABI.encode(S.circuitInfo,['uint256'],[CFG.ruleId]));
      const bytes = ABI.hexToBytes(data);
      const dims = [0,32,64,96].map(offset=>Number(ABI.u256At(bytes,offset)));
      if (dims.join(',') !== '19,1,0,74') throw new Error('链上电路规格与本地规格不一致');
      const registered = ABI.decodeAddress(await call(CFG.factory,ABI.encode('0x4bc7cbbd',['uint256'],[CFG.cpuIndex])));
      if (registered.toLowerCase() !== CFG.circuits.toLowerCase()) throw new Error('工厂登记与电路地址不一致');
      const owner = ABI.decodeAddress(await call(CFG.circuits,ABI.encode(S.ownerOf,['uint256'],[CFG.ruleId])));
      const vectors = [['0x260001','0x01','两票放行'],['0x260005','0x00','紧急冻结'],['0x220001','0x00','单票拒绝'],['0x230001','0x00','自批无效']];
      const rows = await Promise.all(vectors.map(async ([input,expected,label])=>{
        const raw = await call(CFG.circuits,ABI.encode('0x934d06ea',['uint256','bytes'],[CFG.ruleId,input]));
        const actual = '0x'+ABI.hex(ABI.readBytes(ABI.hexToBytes(raw),0));
        if (actual !== expected) throw new Error(label+'链上结果与预期不一致');
        return `<tr><td>${label}</td><td><code>${input}</code></td><td class="ok">${actual} ✓</td></tr>`;
      }));
      if (epoch !== routeEpoch) return;
      result.innerHTML = `<p class="ok">两个节点读数一致 · 区块 ${BigInt(block)}</p><p>工厂登记 ✓ · 电路规格 ✓ · NFT 持有人 <code>${esc(owner)}</code></p><table class="costs"><thead><tr><th>场景</th><th>输入</th><th>链上输出</th></tr></thead><tbody>${rows.join('')}</tbody></table><p class="caption">本次仅核验公开读数。交易网表逐字节比对见仓库 verify-chain 脚本及部署证据。</p>`;
    } catch(error) { if(epoch===routeEpoch) result.innerHTML=`<p class="banner">核验未完成：${esc(error.message)}。请检查网络后重试。</p>`; }
    finally { button.disabled=false; }
  }

  function setupRisk() {
    return `<section class="card"><h2>请只放演示金额</h2>
      <p class="banner">这是未审计原型。底层合约可升级。钱包插件不在保护范围内，批准时请核对提案哈希。</p>
    </section>`;
  }

  function aboutBody() { return whyBody() + `<section class="card"><h2>权限与边界</h2><p>仅签名人可以发起、批准、执行和冻结。发起人的批准位会被电路屏蔽。解冻需要其余成员通过同一规则批准，解冻后旧提案失效。</p><p>阈值必须小于签名人数；必签人不能发起可通过的提案。规则电路不保存状态，审批和重放保护由执行器存储。</p><p>CALL 限制不等于任意 calldata 安全；ERC-20 approve 等调用仍可能授予资产权限。DeWEB 为可选扩展，比赛提交可按本项目要求提供 GitHub 与可公开打开的视频。</p></section>` + setupRisk(); }

  function showTx(hash) {
    app.insertAdjacentHTML("afterbegin", `<p class="card">已提交，尚未确认；确认后点击「刷新状态」。<a href="${CFG.explorer}/tx/${esc(hash)}">${esc(hash)}</a></p>`);
  }
  function showErr(error) {
    app.insertAdjacentHTML("afterbegin", `<p class="banner">${esc(error.message || error)}</p>`);
  }

  async function pinBlock() {
    const chains = await Promise.all(CFG.rpc.map(url => rpc(url, "eth_chainId", [])));
    if (chains.some(x => BigInt(x) !== BigInt(CFG.chainId))) throw new Error("RPC 网络错误");
    if (CFG.rpc.length < 2) throw new Error("需要两条 RPC");
    const heights = await Promise.all(CFG.rpc.map(url => rpc(url, "eth_blockNumber", [])));
    snapshot = "0x" + heights.map(BigInt).reduce((a,b) => a < b ? a : b).toString(16);
    const headers = await Promise.all(CFG.rpc.map(url => rpc(url, "eth_getBlockByNumber", [snapshot, false])));
    if (!headers[0]?.hash || headers.some(x => x?.hash !== headers[0].hash)) throw new Error("RPC 区块哈希不一致");
  }

  async function render() {
    const epoch = ++routeEpoch;
    drawNav();
    const hash = location.hash || "#/";
    if (hash === "#/demo") return window.TapeDemo.render(app);
    if (hash === "#/verify") return verify();
    if (hash === "#/about") { app.innerHTML = aboutBody(); return; }
    if (ready) { try { await pinBlock(); } catch (e) { if (epoch !== routeEpoch) return; app.innerHTML = `<p class="banner">${esc(e.message)}</p>`; return; } }
    if (epoch !== routeEpoch) return;
    if (hash.startsWith("#/p/")) { const id = hash.slice(4); if (!/^[1-9]\d*$/.test(id)) { app.innerHTML = `<p class="banner">无效提案编号</p>`; return; } return detail(id, epoch); }
    if (hash === "#/new") return form();
    if (hash === "#/log") return log(epoch);
    return overview(epoch);
  }

  document.getElementById("connect").onclick = () => connect().catch(showErr);
  document.getElementById("refresh").onclick = render;
  window.addEventListener("hashchange", render);
  if (window.ethereum?.on) {
    window.ethereum.on("accountsChanged", () => { account = ""; document.getElementById("connect").textContent = "连接钱包"; render(); });
    window.ethereum.on("chainChanged", () => { account = ""; render(); });
  }
  render();
})();
