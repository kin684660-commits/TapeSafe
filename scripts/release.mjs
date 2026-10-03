import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const files=['deploy.html','deploy.js','deploy-core.js','index.html','app.css','app.js','abi.js','config.js','policy.js','demo.js','img/processor-hero.png','img/approval-tokens.png','img/freeze-core.png','img/title.jpg','img/board.jpg','img/gate.jpg'];
const hashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(new URL('../tapesafe_web/'+file,import.meta.url))).digest('hex')]));
writeFileSync(new URL('../tapesafe_web/release.json',import.meta.url),JSON.stringify({name:'TapeSafe',version:'0.5.0',status:'unaudited prototype',files,sha256:hashes,note:'Local release manifest only; not proof of on-chain hosting or a trusted bootstrap. Regenerate after editing config.js.'},null,2)+'\n');
console.log('Updated local release hashes for '+files.length+' files.');
