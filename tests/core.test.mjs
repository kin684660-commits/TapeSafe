import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blifToNetlist,bytesToHex} from '../tapesafe_hw/blif2nl.mjs';
import '../tapesafe_web/abi.js';
import '../tapesafe_web/policy.js';
import '../tapesafe_web/demo.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('BLIF, upload netlist, Solidity fixture and browser use identical bytes',()=>{
 for(const name of ['tapesafe_policy','maj3']) {
  const net=blifToNetlist(read(`../tapesafe_hw/${name}.blif`),name);
  const hex=bytesToHex(net.bytes);
  assert.equal(hex,read(`../tapesafe_contracts/testdata/${name}.hex`).trim());
  assert.equal(hex,read(`../tapesafe_hw/${name}.nl.txt`).trim().split('\n')[1]);
  if(name==='tapesafe_policy') {assert.equal(hex,TAPE_POLICY.hex);assert.equal(net.nand,74);assert.equal(net.latch,0);assert.equal(net.nIn,19);assert.equal(net.nOut,1);}
 }
});
test('all 524288 browser NAND evaluations agree with independent policy',()=>{
 for(let bits=0;bits<(1<<19);bits++) assert.equal(TapeDemo.evaluate(TAPE_POLICY.hex,bits).output,TapeDemo.reference(bits),`input ${bits}`);
});
test('known vectors use little endian input bytes',()=>{
 assert.equal(TapeDemo.packed(0x10026),'0x260001');
 assert.equal(TapeDemo.evaluate(TAPE_POLICY.hex,0x10026).output,1);
 assert.equal(TapeDemo.evaluate(TAPE_POLICY.hex,0x50026).output,0);
});
test('ABI rejects malformed bytes, oversized words, addresses and truncated responses',()=>{
 assert.throws(()=>ABI.hexToBytes('0xgg'));
 assert.throws(()=>ABI.word(-1));assert.throws(()=>ABI.word(1n<<256n));
 assert.throws(()=>ABI.encode('0x12345678',['address'],['0x1']));
 assert.throws(()=>ABI.u256At(new Uint8Array(31),0));
 assert.throws(()=>ABI.readBytes(new Uint8Array(32).fill(255),0));
 const encoded=ABI.encode('0x12345678',['uint256','bytes'],[7,'0xaabb']);
 const bytes=ABI.hexToBytes('0x'+encoded.slice(10));
 assert.equal(ABI.u256At(bytes,0),7n);assert.equal(ABI.hex(ABI.readBytes(bytes,32)),'aabb');
});
test('signer rotation ABI uses correct dynamic array offset and words',()=>{
 const addresses=['0x'+'11'.repeat(20),'0x'+'22'.repeat(20),'0x'+'33'.repeat(20)];
 const encoded=ABI.encode(ABI.SEL.applySigners,['address[]','uint8','uint8'],[addresses,2,0]);
 const bytes=ABI.hexToBytes('0x'+encoded.slice(10));
 assert.equal(ABI.u256At(bytes,0),96n);assert.equal(ABI.u256At(bytes,32),2n);
 assert.equal(ABI.u256At(bytes,96),3n);assert.equal(ABI.u256At(bytes,128),BigInt(addresses[0]));
});
test('demo scenario controls render real policy decisions',()=>{
 let markup='';const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{dataset:{case:id.slice(-1)}});return elements.get(id);};
 const app={set innerHTML(value){markup=value;},get innerHTML(){return markup;},querySelector:el,querySelectorAll(selector){return selector==='[data-case]'?[0,1,2,3,4].map(i=>el('case'+i)):[];}};
 TapeDemo.render(app);
 assert.match(markup,/0x260001 → 0x01/);
 el('case1').onclick();assert.match(markup,/→ 0x00/);
 el('case2').onclick();assert.match(markup,/→ 0x00/);
 el('case3').onclick();assert.match(markup,/0x260005 → 0x00/);
 el('case4').onclick();assert.match(markup,/→ 0x00/);
 el('case0').onclick();assert.match(markup,/→ 0x01/);
});
