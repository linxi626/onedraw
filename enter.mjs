// Enter an open draw from every wallet session you control.
//
//   node enter.mjs 2            # dry run: who is eligible, what it would cost
//   node enter.mjs 2 --go       # actually send enter(drawId)
//
// Reads wallet sessions from lib/baw.mjs (same env vars as the other scripts).
// value is always 0 and no approval is ever requested: entering a draw only
// calls enter(uint256), and the contract pays nothing to enter.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { baw, envDir, whoami } from './lib/baw.mjs';

const require = createRequire(import.meta.url);
const { ethers } = require('ethers');

const CHAIN = '56';
const RPC = 'https://bsc-dataseed.binance.org';
const dep = JSON.parse(fs.readFileSync('deployed.json', 'utf8'));
const iface = new ethers.Interface(dep.abi);
const REGISTRY = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);

const drawId = Number(process.argv[2]);
const GO = process.argv.includes('--go');
if (!Number.isInteger(drawId) || drawId < 0) {
  console.log('usage: node enter.mjs <drawId> [--go]');
  process.exit(1);
}

const ENVS = ['wallet-a', 'wallet-b', 'wallet-c', 'wallet-d'];

async function rpc(method, params) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(RPC, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { await new Promise((r) => setTimeout(r, 1000)); if (i === 4) throw e; }
  }
}
const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);
const n = (h) => Number(BigInt(h));

const d = iface.decodeFunctionResult('draws', await call(dep.address, iface.encodeFunctionData('draws', [drawId])));
const closeBlock = Number(d[3]);
const block = parseInt(await rpc('eth_blockNumber', []), 16);
const open = !d[7] && block < closeBlock;

console.log('draw #' + drawId, '| slots', Number(d[5]), '| entries', Number(d[6]),
  '| closeBlock', closeBlock, '| now', block, '|', open ? 'OPEN' : 'closed or settled');
if (!open) process.exit(1);

const data = iface.encodeFunctionData('enter', [drawId]);

for (const name of ENVS) {
  const dir = envDir(name);
  let addr;
  try { addr = whoami(dir); } catch (e) { console.log(name.padEnd(9), 'no session — skipped'); continue; }

  const ids = await call(dep.agentId || '0x60b9262456de011f7d15a54cdd8c48baaa8b022f', REGISTRY.encodeFunctionData('balanceOf', [addr]));
  const already = n(await call(dep.address, iface.encodeFunctionData('entered', [drawId, addr])));
  const bal = ethers.formatEther(await rpc('eth_getBalance', [addr, 'latest']));

  console.log(name.padEnd(9), addr, '| Agent IDs', BigInt(ids).toString(), '| already entered', already, '| BNB', Number(bal).toFixed(6));

  if (BigInt(ids) === 0n || already === 1) { console.log('          skipped'); continue; }
  if (!GO) { console.log('          dry run — would call enter(' + drawId + ')'); continue; }

  const pv = baw(['contract-call', 'preview', '--binanceChainId', CHAIN, '--from', addr,
    '--to', dep.address, '--value', '0', '--inputData', data, '--gasLimit', '260000', '--json'], dir);
  if (!pv.success) { console.log('          preview failed:', JSON.stringify(pv.error || pv).slice(0, 200)); continue; }
  const sim = (pv.data.simulationResult || {});
  if (sim.simulationErrorDetail) { console.log('          simulation reverted:', String(sim.simulationErrorDetail).slice(0, 160)); continue; }
  const rk = pv.data.risks || {};
  if ((rk.riskDetails || []).length || (rk.riskBehaviors || []).length) { console.log('          blocked by risk control'); continue; }

  const ex = baw(['contract-call', 'execute', '--requestId', pv.data.requestId, '--json'], dir);
  if (!ex.success) { console.log('          execute failed:', JSON.stringify(ex.error || ex).slice(0, 200)); continue; }
  const tx = ex.data.txHash;
  let receipt = null;
  for (let i = 0; i < 40 && !receipt; i++) {
    receipt = await rpc('eth_getTransactionReceipt', [tx]);
    if (!receipt) await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('          ' + (receipt ? (receipt.status === '0x1' ? 'OK gas=' + parseInt(receipt.gasUsed, 16) : 'REVERTED') : 'no receipt yet') + ' ' + tx);
}

if (GO) {
  const after = await call(dep.address, iface.encodeFunctionData('draws', [drawId]));
  console.log('\nentries now', Number(iface.decodeFunctionResult('draws', after)[6]));
}
