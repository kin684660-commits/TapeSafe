(function(root){
 const A=root.ABI;
 const P={create:'47f9b5fd',fee:'eb2a5d2c',count:'a94da8a7',at:'4bc7cbbd',mint:'1b2ef1ca',price:'6817c76c',mintFee:'b0e21e8a',tapeout:'7bd3ac1d',tapeFee:'adfb2b69',eval:'934d06ea'};
 const story='TapeSafe: a 74-NAND approval policy circuit. Supply cap 210000; mint unit price 0.000066 OKB, protocol fees and gas still apply. Unaudited prototype. Mainnet scope: processor and policy circuit only; treasury executor is tested locally and on a fork, not deployed.';
 const text=s=>'0x'+A.hex(new TextEncoder().encode(s));
 const create=()=>A.encode('0x'+P.create,['bytes','bytes','bytes','uint256','uint256'],[text('TapeSafe'),text('TSAFE'),text(story),210000,66000000000000n]);
 const mint=()=>A.encode('0x'+P.mint,['uint256','uint256'],[0,74]);
 const tapeout=()=>A.encode('0x'+P.tapeout,['bytes','uint32','uint32'],[root.TAPE_POLICY.hex,19,1]);
 const okb=n=>{n=BigInt(n);return `${n/10n**18n}.${(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,'')||'0'}`;};
 root.DeployCore={P,story,create,mint,tapeout,okb};
})(typeof window!=='undefined'?window:globalThis);
