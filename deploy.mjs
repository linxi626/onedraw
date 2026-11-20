import { createRequire } from 'node:module';
import { baw, envDir } from './lib/baw.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { ethers } = require('ethers');

const CHAIN = '56';
const RPC = 'https://bsc-dataseed.binance.org';
const FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
const AGENT_ID = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const FROM = process.env.WALLET || '0x6c6Ac8FFd105F74a154a000Bda1a0cBbeD2034De';
const ENVDIR = process.env.ENVDIR || envDir('wallet-a');
const GO = process.argv.includes('--go');
const SALT_FILE = 'deploy-salt.txt';

async function rpc(method, params) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(RPC, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1200));
      if (i === 4) throw e;
    }
  }
}

const bin = fs.readFileSync('build/OneDraw.bin', 'utf8').trim();
const abi = JSON.parse(fs.readFileSync('build/OneDraw.abi', 'utf8'));
const ctor = new ethers.Interface(['constructor(address)']).encodeDeploy([AGENT_ID]);
const initcode = '0x' + bin + ctor.slice(2);

let salt;
if (fs.existsSync(SALT_FILE)) {
  salt = fs.readFileSync(SALT_FILE, 'utf8').trim();
} else {
  salt = '0x' + crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SALT_FILE, salt);
}

const predicted = ethers.getCreate2Address(FACTORY, salt, ethers.keccak256(initcode));
const data = salt + initcode.slice(2);

console.log('initcode 字节数 :', (initcode.length - 2) / 2);
console.log('salt           :', salt);
console.log('预测合约地址    :', predicted);
console.log('factory        :', FACTORY);
console.log('部署者          :', FROM);

const existing = await rpc('eth_getCode', [predicted, 'latest']);
if (existing && existing !== '0x') {
  console.log('该地址已有代码，改为读取：');
  console.log('  runtime 字节数:', (existing.length - 2) / 2);
  process.exit(0);
}

const gasPrice = BigInt(await rpc('eth_gasPrice', []));
console.log('gasPrice       :', Number(gasPrice) / 1e9, 'gwei');
console.log('估算上限费用    :', (3_000_000n * gasPrice) / 10n ** 18n, 'BNB (gasLimit 3,000,000)');

if (!GO) {
  console.log('\n[DRY] 未发送。加 --go 才会真正部署。');
  process.exit(0);
}

console.log('\npreview…');
const pv = baw(['contract-call', 'preview', '--binanceChainId', CHAIN,
  '--from', FROM, '--to', FACTORY, '--value', '0',
  '--inputData', data, '--gasLimit', '3000000', '--json'], ENVDIR);
if (!pv.success) {
  console.log('preview 失败:', JSON.stringify(pv.error || pv).slice(0, 400));
  process.exit(1);
}
const pdata = pv.data;
const risks = pdata.risks || {};
if ((risks.riskDetails || []).length || (risks.riskBehaviors || []).length) {
  console.log('风控拦截:', JSON.stringify(risks).slice(0, 400));
  process.exit(1);
}
const sim = pdata.simulationResult || {};
if (sim.simulationErrorDetail) {
  console.log('模拟报错:', String(sim.simulationErrorDetail).slice(0, 300));
  process.exit(1);
}
console.log('preview OK, requestId =', pdata.requestId, 'gasLimit =', pdata.gasLimit);

console.log('execute…');
const ex = baw(['contract-call', 'execute', '--requestId', pdata.requestId, '--json'], ENVDIR);
if (!ex.success) {
  console.log('execute 失败:', JSON.stringify(ex.error || ex).slice(0, 400));
  process.exit(1);
}
const txHash = ex.data.txHash;
console.log('txHash:', txHash);

for (let i = 0; i < 40; i++) {
  const rc = await rpc('eth_getTransactionReceipt', [txHash]);
  if (rc) {
    console.log('status :', rc.status);
    console.log('gasUsed:', parseInt(rc.gasUsed, 16));
    const code = await rpc('eth_getCode', [predicted, 'latest']);
    console.log('runtime 字节数:', code === '0x' ? 0 : (code.length - 2) / 2);
    console.log('合约地址:', predicted);
    if (rc.status !== '0x1') { console.log('部署失败'); process.exit(1); }
    fs.writeFileSync('deployed.json', JSON.stringify({ address: predicted, txHash, abi, agentId: AGENT_ID, salt }, null, 2));
    console.log('已写入 deployed.json');
    process.exit(0);
  }
  await new Promise(r => setTimeout(r, 3000));
}
console.log('等待回执超时，稍后用 txHash 复查');
