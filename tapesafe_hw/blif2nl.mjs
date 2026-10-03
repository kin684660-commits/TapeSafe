// BLIF (NAND-mapped, flat) -> TapeOut binary netlist.
// Signal 0 = const 0, signal 1 = const 1, signals 2.. are inputs, then gates.
// Each NAND is 7 bytes: opcode 0 + u24 a + u24 b.
// Each LATCH is 4 bytes: opcode 1 + u24 d. Clock is dropped.
// The last nOut gates are the outputs. Each output gets two NAND buffers.

import { readFileSync, writeFileSync } from "node:fs";

const NAND = 0;
const LATCH = 1;

function parseBlif(text) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim()).filter(Boolean);
  let inputs = [];
  let outputs = [];
  const gates = [];
  const latches = [];
  let i = 0;
  while (i < lines.length) {
    const parts = lines[i].split(/\s+/);
    const head = parts[0];
    if (head === ".inputs") inputs = parts.slice(1);
    else if (head === ".outputs") outputs = parts.slice(1);
    else if (head === ".latch") {
      latches.push({ d: parts[1], q: parts[2], edge: parts[3], init: parts[parts.length - 1] });
    } else if (head === ".names") {
      const names = parts.slice(1);
      const out = names[names.length - 1];
      const ins = names.slice(0, -1);
      const cubes = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith(".")) {
        cubes.push(lines[i].split(/\s+/));
        i += 1;
      }
      gates.push({ ins, out, cubes });
      continue;
    }
    i += 1;
  }
  return { inputs, outputs, gates, latches };
}

function evalGate(ins, cubes, values) {
  if (ins.length === 0) {
    if (cubes.length === 0) return 0;
    return cubes[0][0] === "1" ? 1 : 0;
  }
  const polarity = cubes.length ? cubes[0][cubes[0].length - 1] : "1";
  const on = polarity !== "0";
  const hit = cubes.some((cube) => {
    const pat = cube[0];
    return ins.every((_, k) => pat[k] === "-" || Number(pat[k]) === values[k]);
  });
  return hit === on ? 1 : 0;
}

function classify(gate) {
  const n = gate.ins.length;
  if (n === 0) return evalGate([], gate.cubes, []) === 1 ? "one" : "zero";
  if (n > 2) throw new Error(`gate ${gate.out} has ${n} inputs; flatten to NAND`);
  const rows = [];
  const combos = n === 1 ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
  for (const combo of combos) rows.push(evalGate(gate.ins, gate.cubes, combo));
  const key = rows.join("");
  if (n === 1 && key === "10") return "not";
  if (n === 1 && key === "01") return "buf";
  if (n === 2 && key === "1110") return "nand";
  if (n === 2 && key === "0001") return "and";
  throw new Error(`gate ${gate.out} is not NAND/NOT/buffer (truth ${key})`);
}

function u24(bytes, value) {
  if (value < 0 || value > 0xffffff) throw new Error(`signal ${value} out of u24`);
  bytes.push((value >>> 16) & 255, (value >>> 8) & 255, value & 255);
}

function canonicalInputs(model, inputs, latches) {
  const clock = new Set(latches.map(() => "clk"));
  const pins = inputs.filter((name) => !clock.has(name) && name !== "clk");
  if (model === "maj3") return ["a", "b", "c"];
  if (model === "tapesafe_policy") {
    const want = [];
    for (const bus of ["appr", "prop", "must"]) for (let i = 0; i < 5; i += 1) want.push(`${bus}[${i}]`);
    for (let i = 0; i < 3; i += 1) want.push(`m[${i}]`);
    want.push("frozen");
    return want;
  }
  if (model === "approval_reg") {
    const want = [];
    for (let i = 0; i < 5; i += 1) want.push(`sig[${i}]`);
    want.push("clr");
    for (let i = 0; i < 3; i += 1) want.push(`m[${i}]`);
    return want;
  }
  return pins;
}

function canonicalOutputs(model, outputs) {
  if (model === "approval_reg") {
    const want = ["ok"];
    for (let i = 0; i < 5; i += 1) want.push(`q[${i}]`);
    return want;
  }
  return outputs;
}

export function blifToNetlist(text, model) {
  const blif = parseBlif(text);
  const inputs = canonicalInputs(model, blif.inputs, blif.latches);
  const outputs = canonicalOutputs(model, blif.outputs);
  const missing = [...inputs, ...outputs].filter((name) => !blif.inputs.includes(name) && !blif.gates.some((g) => g.out === name) && !blif.latches.some((l) => l.q === name) && !outputs.includes(name));
  for (const name of inputs) {
    if (!blif.inputs.includes(name)) throw new Error(`${model}: BLIF is missing input ${name}; have ${blif.inputs.join(" ")}`);
  }
  const id = new Map();
  inputs.forEach((name, index) => id.set(name, 2 + index));
  let next = 2 + inputs.length;
  const elements = [];
  const nandOf = (a, b) => {
    const out = next++;
    elements.push({ op: NAND, a, b, out });
    return out;
  };
  const latchOf = (d) => {
    const out = next++;
    elements.push({ op: LATCH, d, out });
    return out;
  };

  for (const latch of blif.latches) {
    if (latch.init !== "0") throw new Error(`latch ${latch.q} init must be 0`);
    id.set(latch.q, latchOf(0));
  }

  const pending = blif.gates.slice();
  const ordered = [];
  let guard = pending.length + 1;
  while (pending.length) {
    const ready = pending.findIndex((gate) => gate.ins.every((name) => id.has(name)));
    if (ready < 0) throw new Error(`combinational loop at ${pending[0].out}`);
    ordered.push(pending.splice(ready, 1)[0]);
    const gate = ordered[ordered.length - 1];
    const kind = classify(gate);
    if (kind === "zero" || kind === "one") id.set(gate.out, kind === "one" ? 1 : 0);
    else id.set(gate.out, `pending:${gate.out}`);
    if (--guard < 0) throw new Error("topo failed");
  }

  for (const gate of ordered) {
    const kind = classify(gate);
    if (kind === "zero" || kind === "one") continue;
    const src = gate.ins.map((name) => {
      const value = id.get(name);
      if (typeof value !== "number") throw new Error(`gate ${gate.out} reads ${name} before it exists`);
      return value;
    });
    let out;
    if (kind === "zero") out = 0;
    else if (kind === "one") out = 1;
    else if (kind === "not") out = nandOf(src[0], 1);
    else if (kind === "nand") out = nandOf(src[0], src[1]);
    else if (kind === "buf") out = nandOf(nandOf(src[0], src[0]), nandOf(src[0], src[0]));
    else if (kind === "and") out = nandOf(nandOf(src[0], src[1]), nandOf(src[0], src[1]));
    else throw new Error(kind);
    id.set(gate.out, out);
  }

  for (const latch of blif.latches) {
    if (!id.has(latch.d)) throw new Error(`latch ${latch.q} has no data ${latch.d}`);
    const element = elements.find((item) => item.out === id.get(latch.q));
    element.d = id.get(latch.d);
  }

  const outputIds = [];
  for (const name of outputs) {
    if (!id.has(name)) throw new Error(`${model}: missing output ${name}`);
    const sig = id.get(name);
    const buf = nandOf(sig, sig);
    outputIds.push(nandOf(buf, buf));
  }

  const bytes = [];
  let nand = 0;
  let latch = 0;
  for (const element of elements) {
    if (element.op === NAND) {
      bytes.push(NAND);
      u24(bytes, element.a);
      u24(bytes, element.b);
      nand += 1;
    } else {
      bytes.push(LATCH);
      u24(bytes, element.d);
      latch += 1;
    }
  }
  return {
    model,
    nIn: inputs.length,
    nOut: outputs.length,
    nand,
    latch,
    bytes: Uint8Array.from(bytes),
    inputs,
    outputs,
    outputIds,
    unused: missing.length,
  };
}

export function bytesToHex(bytes) {
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node blif2nl.mjs file.blif");
    process.exit(1);
  }
  const model = file.replace(/^.*\//, "").replace(/\.blif$/, "");
  const nl = blifToNetlist(readFileSync(file, "utf8"), model);
  const hex = bytesToHex(nl.bytes);
  const header = `nIn=${nl.nIn} nOut=${nl.nOut} NAND=${nl.nand} LATCH=${nl.latch} bytes=${nl.bytes.length}`;
  console.log(header);
  console.log(hex);
  writeFileSync(file.replace(/\.blif$/, ".nl.txt"), `${header}\n${hex}\n`);
}

if (process.argv[1] && process.argv[1].endsWith("blif2nl.mjs")) main();
