import { createRequire } from 'node:module';
import fs from 'node:fs';
import { baw, envDir } from './lib/baw.mjs';

const require = createRequire(import.meta.url);
const { ethers } = require('ethers');

const CHAIN = '56';
const RPC = 'https://bsc-dataseed.binance.org';
const dep = JSON.parse(fs.readFileSync('deployed.json', 'utf8'));
const iface = new ethers.Interface(dep.abi);

// Demo wallets that took part in the mainnet dry run of draw #1.
// Override any of them with WALLET_A..WALLET_D (env), or edit this list.
const W = [
  { n: 'A', a: process.env.WALLET_A || '0x6c6Ac8FFd105F74a154a000Bda1a0cBbeD2034De', d: envDir('wallet-a') },
  { n: 'B', a: process.env.WALLET_B || '0x2bAd95bc8791509FFF4a0a1902E4df1e0F030a77', d: envDir('wallet-b') },
  { n: 'C', a: process.env.WALLET_C || '0x064b9DeDF6c802Ab0ACA45FE2B5F88C87173b613', d: envDir('wallet-c') },
  { n: 'D', a: process.env.WALLET_D || '0x69Cc81135051a5a2d76eE90598fD4e98A7832284', d: envDir('wallet-d') },
];

async function rpc(method, params) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(RPC, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { await new Promise(r => setTimeout(r, 1200)); if (i === 5) throw e; }
  }
}
const blk = async () => parseInt(await rpc('eth_blockNumber', []), 16);

async function send(from, data, gas, envdir, label) {
  const pv = baw(['contract-call', 'preview', '--binanceChainId', CHAIN, '--from', from,
    '--to', dep.address, '--value', '0', '--inputData', data, '--gasLimit', String(gas), '--json'], envdir);
  if (!pv.success) { console.log(`  ${label} preview 失败:`, JSON.stringify(pv.error || pv).slice(0, 240)); return null; }
  const d = pv.data;
  const rk = d.risks || {};
  if ((rk.riskDetails || []).length || (rk.riskBehaviors || []).length) { console.log(`  ${label} 风控拦截`, JSON.stringify(rk).slice(0, 200)); return null; }
  if ((d.simulationResult || {}).simulationErrorDetail) { console.log(`  ${label} 模拟报错:`, String(d.simulationResult.simulationErrorDetail).slice(0, 200)); return null; }
  const ex = baw(['contract-call', 'execute', '--requestId', d.requestId, '--json'], envdir);
  if (!ex.success) { console.log(`  ${label} execute 失败:`, JSON.stringify(ex.error || ex).slice(0, 240)); return null; }
  const tx = ex.data.txHash;
  for (let i = 0; i < 30; i++) {
    const rc = await rpc('eth_getTransactionReceipt', [tx]);
    if (rc) {
      if (rc.status !== '0x1') { console.log(`  ${label} 回滚 ${tx}`); return null; }
      console.log(`  ${label} OK gas=${parseInt(rc.gasUsed, 16)} ${tx}`);
      return { tx, gas: parseInt(rc.gasUsed, 16) };
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`  ${label} 回执超时 ${tx}`);
  return null;
}

const mode = process.argv[2] || 'all';

if (mode === 'create' || mode === 'all') {
  console.log('== 1. 发起抽签（A 为发起人，2 个名额，窗口 20 块，无 NFT 托管）');
  const data = iface.encodeFunctionData('createDraw', [ethers.ZeroAddress, 0, 2, 400]);
  const r = await send(W[0].a, data, 300000, W[0].d, 'createDraw');
  if (r) {
    const n = await rpc('eth_call', [{ to: dep.address, data: iface.encodeFunctionData('drawCount') }, 'latest']);
    const id = parseInt(n, 16) - 1;
    fs.writeFileSync('draw.json', JSON.stringify({ drawId: id, createTx: r.tx }, null, 2));
    console.log('  drawId =', id, '→ 写入 draw.json');
  }
}

const dj = fs.existsSync('draw.json') ? JSON.parse(fs.readFileSync('draw.json', 'utf8')) : null;

if ((mode === 'enter' || mode === 'all') && dj) {
  console.log('== 2. 四个钱包依次参与');
  const data = iface.encodeFunctionData('enter', [dj.drawId]);
  for (const w of W) {
    await send(w.a, data, 260000, w.d, `enter ${w.n}`);
  }
}

if ((mode === 'settle' || mode === 'all') && dj) {
  console.log('== 3. 等待结算区块后结算');
  const raw = await rpc('eth_call', [{ to: dep.address, data: iface.encodeFunctionData('draws', [dj.drawId]) }, 'latest']);
  const d = iface.decodeFunctionResult('draws', raw);
  const settleBlock = Number(d[4]);
  console.log('  closeBlock =', Number(d[3]), 'settleBlock =', settleBlock, '当前 =', await blk());
  while ((await blk()) < settleBlock) await new Promise(r => setTimeout(r, 2500));
  console.log('  到达结算区块', await blk());
  const data = iface.encodeFunctionData('settle', [dj.drawId]);
  await send(W[0].a, data, 400000, W[0].d, 'settle');
}

if (mode === 'report' || mode === 'all') {
  console.log('== 4. 结果核对');
  const raw = await rpc('eth_call', [{ to: dep.address, data: iface.encodeFunctionData('draws', [dj.drawId]) }, 'latest']);
  const d = iface.decodeFunctionResult('draws', raw);
  console.log('  winners =', Number(d[5]), 'entries =', Number(d[6]), 'settled =', d[7], 'prizeOut =', d[8]);
  for (const w of W) {
    const win = await rpc('eth_call', [{ to: dep.address, data: iface.encodeFunctionData('isWinner', [dj.drawId, w.a]) }, 'latest']);
    const ent = await rpc('eth_call', [{ to: dep.address, data: iface.encodeFunctionData('entered', [dj.drawId, w.a]) }, 'latest']);
    const cnt = await rpc('eth_call', [{ to: dep.address, data: iface.encodeFunctionData('drawsEntered', [w.a]) }, 'latest']);
    console.log(`  ${w.n.padEnd(8)} entered=${parseInt(ent, 16)} winner=${parseInt(win, 16)} drawsEntered=${parseInt(cnt, 16)}`);
  }
  const list = await rpc('eth_call', [{ to: dep.address, data: iface.encodeFunctionData('entrants', [dj.drawId]) }, 'latest']);
  const arr = iface.decodeFunctionResult('entrants', list)[0];
  console.log('  entrants:', arr.join(' '));

  const vh = await rpc('eth_call', [{ to: dep.address, data: iface.encodeFunctionData('isVerifiedAgent', [W[0].a]) }, 'latest']);
  console.log('  isVerifiedAgent(A) =', parseInt(vh, 16));
}
