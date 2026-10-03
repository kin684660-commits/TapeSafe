import { readFileSync } from "node:fs";
import { blifToNetlist } from "./blif2nl.mjs";

function decode(bytes, nIn) {
  const elements = [];
  let next = 2 + nIn;
  let p = 0;
  while (p < bytes.length) {
    const op = bytes[p++];
    if (op === 0) {
      const a = (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2]; p += 3;
      const b = (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2]; p += 3;
      elements.push({ op, a, b, out: next++ });
    } else if (op === 1) {
      const d = (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2]; p += 3;
      elements.push({ op, d, out: next++ });
    } else throw new Error(`bad opcode ${op}`);
  }
  return elements;
}

export function evalNet(nl, inputBits, stateBits = []) {
  const elements = decode(nl.bytes, nl.nIn);
  const sig = new Map([[0, 0], [1, 1]]);
  for (let i = 0; i < nl.nIn; i += 1) sig.set(2 + i, inputBits[i] ? 1 : 0);
  let latch = 0;
  const latches = [];
  for (const el of elements) {
    if (el.op === 1) {
      sig.set(el.out, stateBits[latch] ? 1 : 0);
      latches.push(el);
      latch += 1;
    } else {
      const a = sig.get(el.a);
      const b = sig.get(el.b);
      if (a === undefined || b === undefined) throw new Error(`nand reads unset ${el.a},${el.b}`);
      sig.set(el.out, a && b ? 0 : 1);
    }
  }
  const outs = elements.slice(-nl.nOut).map((el) => sig.get(el.out));
  const newState = latches.map((el) => {
    const d = sig.get(el.d);
    if (d === undefined) throw new Error(`latch D ${el.d} unset`);
    return d;
  });
  return { outs, newState };
}

function policyRef(bits) {
  const appr = bits.slice(0, 5);
  const prop = bits.slice(5, 10);
  const must = bits.slice(10, 15);
  const m = bits[15] + 2 * bits[16] + 4 * bits[17];
  const frozen = bits[18];
  const eff = appr.map((bit, i) => bit && !prop[i] ? 1 : 0);
  const cnt = eff.reduce((s, b) => s + b, 0);
  const mustOk = must.every((bit, i) => !bit || eff[i]);
  return !frozen && m !== 0 && cnt >= m && mustOk ? 1 : 0;
}

function majRef(bits) {
  const [a, b, c] = bits;
  return ((a && c) || (b && (a || c))) ? 1 : 0;
}

function bitsOf(value, width) {
  const bits = [];
  for (let i = 0; i < width; i += 1) bits.push((value >> i) & 1);
  return bits;
}

const policy = blifToNetlist(readFileSync("tapesafe_policy.blif", "utf8"), "tapesafe_policy");
const maj = blifToNetlist(readFileSync("maj3.blif", "utf8"), "maj3");
console.log(`policy NAND=${policy.nand} LATCH=${policy.latch} bytes=${policy.bytes.length} nIn=${policy.nIn}`);
console.log(`maj3   NAND=${maj.nand} LATCH=${maj.latch} bytes=${maj.bytes.length} nIn=${maj.nIn}`);

let bad = 0;
for (let i = 0; i < 8; i += 1) {
  const bits = bitsOf(i, 3);
  const got = evalNet(maj, bits).outs[0];
  if (got !== majRef(bits)) bad += 1;
}
console.log(bad === 0 ? "maj3 8/8" : `maj3 FAIL ${bad}`);

if (bad !== 0) process.exit(1);
bad = 0;
for (let i = 0; i < 524288; i += 1) {
  const bits = bitsOf(i, 19);
  const got = evalNet(policy, bits).outs[0];
  if (got !== policyRef(bits)) bad += 1;
}
console.log(bad === 0 ? "policy 524288/524288" : `policy FAIL ${bad}`);

const known = evalNet(policy, bitsOf(0x010026, 19)).outs[0];
console.log(`vector 0x260001 -> ${known} (want 1)`);
if (known !== 1 || bad !== 0) process.exit(1);
