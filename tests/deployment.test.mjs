import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {A,P,createData,tapeData,netlist,address,sameRPC} from '../scripts/protocol.mjs';
const plan=JSON.parse(readFileSync(new URL('../deployment/plan.json',import.meta.url),'utf8'));
test('create payload roundtrips UTF-8 strings, supply and agreed unit price',()=>{
 const input=createData({...plan,story:'TapeSafe 未审计原型'});
 assert.equal(input.slice(0,10),'0x47f9b5fd');
 const bytes=A.hexToBytes(input.slice(10));
 assert.equal(Buffer.from(A.readBytes(bytes,0)).toString(),'TapeSafe');
 assert.equal(Buffer.from(A.readBytes(bytes,32)).toString(),'TSAFE');
 assert.equal(Buffer.from(A.readBytes(bytes,64)).toString(),'TapeSafe 未审计原型');
 assert.equal(A.u256At(bytes,96),210000n);assert.equal(A.u256At(bytes,128),66000000000000n);
});
test('tapeout contains the exact full 518-byte policy and correct dimensions',()=>{
 const input=tapeData();assert.equal(input.slice(0,10),'0x7bd3ac1d');
 const bytes=A.hexToBytes(input.slice(10));
 assert.equal('0x'+A.hex(A.readBytes(bytes,0)),netlist());
 assert.equal(A.readBytes(bytes,0).length,518);assert.equal(A.u256At(bytes,32),19n);assert.equal(A.u256At(bytes,64),1n);
});
test('deployment plan rejects unsafe malformed inputs and placeholders',()=>{
 assert.throws(()=>createData({...plan,mintPriceWei:'-1'}));
 assert.throws(()=>createData({...plan,supply:'5'}));
 assert.throws(()=>address('0x'+'0'.repeat(40),'wallet'));
 assert.throws(()=>address('0xYOUR_WALLET','wallet'));
});

test('RPC comparison accepts reordered nested keys but rejects changed receipt data',()=>{
 assert.equal(sameRPC({hash:'0xaa',logs:[{topics:['0x1'],data:'0x02'}]},{logs:[{data:'0x02',topics:['0x1']}],hash:'0xaa'}),true);
 assert.equal(sameRPC({status:'0x1'},{status:'0x0'}),false);
 assert.equal(sameRPC({logs:[{data:'0x02'}]},{logs:[{data:'0x03'}]}),false);
 assert.equal(sameRPC({a:1,b:2},{a:1}),false);
});
