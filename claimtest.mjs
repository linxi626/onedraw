import { createRequire } from 'node:module';
import fs from 'node:fs';
import { baw, envDir } from './lib/baw.mjs';
const require = createRequire(import.meta.url);
const { ethers } = require('ethers');
const dep = JSON.parse(fs.readFileSync('deployed.json','utf8'));
const dj = JSON.parse(fs.readFileSync('draw.json','utf8'));
const iface = new ethers.Interface(dep.abi);
const RPC='https://bsc-dataseed.binance.org';
async function rpc(m,p){for(let i=0;i<6;i++){try{const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})});const j=await r.json();if(j.error)throw new Error(j.error.message);return j.result;}catch(e){await new Promise(r=>setTimeout(r,1200));if(i===5)throw e;}}}
const A=process.env.WALLET_A||'0x6c6Ac8FFd105F74a154a000Bda1a0cBbeD2034De';
const C=process.env.WALLET_C||'0x064b9DeDF6c802Ab0ACA45FE2B5F88C87173b613';
const data=iface.encodeFunctionData('claim',[dj.drawId]);
// 非中签者 C 应被拒
const sim=await rpc('eth_call',[{from:C,to:dep.address,data},'latest']).then(r=>'未拒绝(!) '+r).catch(e=>'被拒: '+e.message.slice(0,60));
console.log('C 非中签者 claim 模拟 →',sim);
// 中签者 A 真实领取
const pv=baw(['contract-call','preview','--binanceChainId','56','--from',A,'--to',dep.address,'--value','0','--inputData',data,'--gasLimit','120000','--json'],envDir('wallet-a'));
if(!pv.success){console.log('A preview 失败',JSON.stringify(pv.error).slice(0,200));process.exit(1);}
const ex=baw(['contract-call','execute','--requestId',pv.data.requestId,'--json'],envDir('wallet-a'));
console.log('A claim tx:',ex.data.txHash);
for(let i=0;i<20;i++){const rc=await rpc('eth_getTransactionReceipt',[ex.data.txHash]);if(rc){console.log('status',rc.status,'gas',parseInt(rc.gasUsed,16));break;}await new Promise(r=>setTimeout(r,2500));}
const cl=await rpc('eth_call',[{to:dep.address,data:iface.encodeFunctionData('claimed',[dj.drawId,A])},'latest']);
console.log('claimed[A] =',parseInt(cl,16));
// 重复领取应被拒
const sim2=await rpc('eth_call',[{from:A,to:dep.address,data},'latest']).then(r=>'未拒绝(!)').catch(e=>'被拒: '+e.message.slice(0,50));
console.log('A 重复 claim 模拟 →',sim2);
