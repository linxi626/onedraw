// Settlement keeper.
//
//   node keeper.mjs           # dry run: report what needs settling
//   node keeper.mjs --go      # settle whatever is due
//
// Why this exists: blockhash(settleBlock) is only readable for 256 blocks, which on
// BSC is about 1.9 minutes at 0.45s/block. Missing that window is not fatal — the
// contract has settleLate() — but a normal settlement is strictly better than a
// degraded one (distinct event, different seed derivation), so the keeper always
// prefers the normal path and only falls back once the window is provably gone.
//
// Safe to run as often as you like: settle()/settleLate() revert once a draw is
// settled, so there is no double-settlement risk.
import { baw, envDir, whoami } from './lib/baw.mjs';

const RPC = process.env.BSC_RPC || 'https://bsc-dataseed.binance.org';
const CONTRACT = process.env.ONEDRAW || '0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b';
const CALLER_ENV = process.env.KEEPER_ENV || envDir('wallet-a');
const GO = process.argv.includes('--go');
const WINDOW = 255;

const pad = n => BigInt(n).toString(16).padStart(64, '0');
const SEL = { drawCount: '0x08222d58', draws: '0x0cc36c36', settle: '0x8df82800', settleLate: '0x1bec71e7' };

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
    } catch (e) { if (i === 5) throw e; await new Promise(r => setTimeout(r, 1500)); }
  }
}
const words = h => {
  const d = (h || '0x').slice(2), o = [];
  for (let i = 0; i + 64 <= d.length; i += 64) o.push(BigInt('0x' + d.slice(i, i + 64)));
  return o;
};
const call = data => rpc('eth_call', [{ to: CONTRACT, data }, 'latest']);

const head = parseInt(await rpc('eth_blockNumber', []), 16);
const n = Number(words(await call(SEL.drawCount))[0] || 0n);
console.log('block', head, '| draws', n, GO ? '| LIVE' : '| DRY RUN');

const jobs = [];
for (let i = 0; i < n; i++) {
  const w = words(await call(SEL.draws + pad(i)));
  const settleBlock = Number(w[4]), entries = Number(w[6]), settled = w[7] === 1n;
  if (settled) { console.log(`draw ${i}: already settled`); continue; }
  if (head < settleBlock) {
    console.log(`draw ${i}: open until block ${Number(w[3])}, ${(settleBlock - head)} blocks to settle`);
    continue;
  }
  if (head <= settleBlock + WINDOW) {
    console.log(`draw ${i}: IN WINDOW → settle() (entries ${entries})`);
    jobs.push({ id: i, data: SEL.settle + pad(i), kind: 'settle' });
  } else {
    console.log(`draw ${i}: window expired → settleLate() (entries ${entries})`);
    jobs.push({ id: i, data: SEL.settleLate + pad(i), kind: 'settleLate' });
  }
}

if (!jobs.length) { console.log('nothing to do'); process.exit(0); }
if (!GO) { console.log('\n加 --go 才会真正发交易'); process.exit(0); }

const from = whoami(CALLER_ENV);
for (const job of jobs) {
  const pv = baw(['contract-call', 'preview', '--binanceChainId', '56', '--from', from,
    '--to', CONTRACT, '--value', '0', '--inputData', job.data, '--gasLimit', '200000', '--json'], CALLER_ENV);
  if (!pv.success) { console.error(`draw ${job.id} preview failed`, JSON.stringify(pv.error).slice(0, 240)); continue; }
  const ex = baw(['contract-call', 'execute', '--requestId', pv.data.requestId, '--json'], CALLER_ENV);
  if (!ex.success) { console.error(`draw ${job.id} execute failed`, JSON.stringify(ex.error).slice(0, 240)); continue; }
  console.log(`draw ${job.id} ${job.kind} tx ${ex.data.txHash}`);
  for (let i = 0; i < 30; i++) {
    const rc = await rpc('eth_getTransactionReceipt', [ex.data.txHash]);
    if (rc) { console.log('  status', rc.status, 'gas', parseInt(rc.gasUsed, 16)); break; }
    await new Promise(r => setTimeout(r, 2500));
  }
}
