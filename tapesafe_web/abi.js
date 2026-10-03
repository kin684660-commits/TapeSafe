// ABI encoder for the calls this page makes. Selectors were taken from keccak256
// of the canonical signatures (checked with cast). The page reads proposal hashes
// from the contract, so it does not reimplement keccak.
(function (root) {
  const SEL = {
    applyUnfreeze: "0x1e804bc6",
    applySigners: "0x901f64ef",
    custodyOk: "0x3d108053",
    threshold: "0x42cde4e8",
    mustMask: "0x16f3ae50",
    frozen: "0x054f7d9c",
    configNonce: "0x3462ceff",
    nextId: "0x61b8ce8c",
    signerCount: "0x7ca548c6",
    signers: "0x2079fb9a",
    hashOf: "0x7e551b75",
    circuitInfo: "0x084d60f1",
    ownerOf: "0x6352211e",
    vaultId: "0x33194c0a",
    ruleId: "0xd3c1b0c9",
    circuits: "0x5f48772d",
    container: "0x90e534a7",
    propose: "0x9cc46cc7",
    approve: "0x93cdd68b",
    revoke: "0x20c5429b",
    cancel: "0x40e58ee5",
    freeze: "0x62a5af3b",
    execute: "0xfe0d94c1",
    previewHash: "0xa414ace8",
    check: "0x5f72f450",
    inputsFor: "0x66e1a9ad",
    proposalInfo: "0xae092e89",
    execFee: "0x00124bf4",
  };

  const word = (value) => { const n = BigInt(value); if (n < 0n || n >= (1n << 256n)) throw new Error("uint256 overflow"); return n.toString(16).padStart(64, "0"); };
  const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

  function hexToBytes(value) {
    const h = String(value || "").replace(/^0x/, "");
    if (!/^[0-9a-fA-F]*$/.test(h) || h.length % 2) throw new Error("bad hex");
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  function encodeBytes(data) {
    const bytes = typeof data === "string" ? hexToBytes(data || "0x") : data;
    return word(bytes.length) + hex(bytes).padEnd(Math.ceil(bytes.length / 32) * 64, "0");
  }

  function encode(selector, types, values) {
    let head = "";
    let tail = "";
    types.forEach((type, i) => {
      if (type === "address[]") {
        head += word(types.length * 32 + tail.length / 2);
        tail += word(values[i].length);
        for (const address of values[i]) { if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("bad address"); tail += word(BigInt(address)); }
      } else if (type === "bytes") {
        head += word(types.length * 32 + tail.length / 2);
        tail += encodeBytes(values[i]);
      } else if (type === "address") { if (!/^0x[0-9a-fA-F]{40}$/.test(values[i])) throw new Error("bad address"); head += word(BigInt(values[i])); }
      else if (type === "bytes32") { if (!/^0x[0-9a-fA-F]{64}$/.test(values[i])) throw new Error("bad bytes32"); head += values[i].slice(2); }
      else head += word(values[i]);
    });
    return selector + head + tail;
  }

  function u256At(bytes, offset) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset + 32 > bytes.length) throw new Error("truncated ABI word");
    let n = 0n;
    for (let i = 0; i < 32; i++) n = (n << 8n) | BigInt(bytes[offset + i] || 0);
    return n;
  }

  function readBytes(bytes, pointer) {
    const start = Number(u256At(bytes, pointer));
    const len = Number(u256At(bytes, start));
    if (!Number.isSafeInteger(len) || start + 32 + len > bytes.length) throw new Error("truncated ABI bytes");
    return bytes.slice(start + 32, start + 32 + len);
  }

  function decodeUint(hexResult) {
    if (!hexResult || hexResult === "0x") return 0n;
    return BigInt(hexResult);
  }

  function decodeAddress(hexResult) {
    const n = decodeUint(hexResult);
    return "0x" + n.toString(16).padStart(40, "0");
  }

  root.ABI = { SEL, word, hex, hexToBytes, encode, u256At, readBytes, decodeUint, decodeAddress };
})(typeof window !== "undefined" ? window : globalThis);
