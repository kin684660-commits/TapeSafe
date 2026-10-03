import {readFileSync} from 'node:fs';
import '../tapesafe_web/abi.js';
const paths=['TapeSafeModule.sol/TapeSafeModule','TapeSafeFork.t.sol/ICircuits','TapeSafeFork.t.sol/IAccount'];
const methods=Object.assign({},...paths.map(p=>JSON.parse(readFileSync(new URL('../tapesafe_contracts/out/'+p+'.json',import.meta.url))).methodIdentifiers));
for(const [name,selector] of Object.entries(ABI.SEL)) {
 const method=Object.keys(methods).find(key=>key.startsWith((name==='execFee'?'EXEC_FEE':name)+'('));
 if(!method || '0x'+methods[method]!==selector)throw new Error(`ABI mismatch: ${name}`);
}
console.log(`All ${Object.keys(ABI.SEL).length} frontend selectors match compiled contracts.`);
