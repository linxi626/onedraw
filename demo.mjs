// OneDraw — read-only proof run.
//
// Prints five things a viewer can check against the chain themselves, in the
// order the demo video walks through them. Needs no wallet, no key, no write
// access: every call here is eth_call / eth_getCode on a public RPC.
//
//   npm install && node demo.mjs
//
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { ethers } = require('ethers');

const dep = JSON.parse(fs.readFileSync(new URL('./deployed.json', import.meta.url), 'utf8'));
const ADDR = dep.address;
const iface = new ethers.Interface(dep.abi);

const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-rpc.publicnode.com'];

// Addresses used in the mainnet dry run of draw #1 (public, already on chain).
const A = '0x6c6Ac8FFd105F74a154a000Bda1a0cBbeD2034De';
const NOBODY = '0x000000000000000000000000000000000000dEaD';

const ERRORS = {
  '0x618c7242': 'NotWinner()',
  '0x78636683': 'AlreadyEntered()',
  '0x7284d046': 'EntryClosed()',
  '0xea11784e': 'NotAgentIdHolder()',
  '0x085de625': 'TooEarly()',
};

let rpcUrl = RPCS[0];

async function rpc(method, params) {
  let lastErr;
  for (const url of RPCS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        });
        const j = await r.json();
        if (j.error) {
          // Some RPCs fold the revert data into the message, some keep it in a
          // separate field. Keep both so the selector survives either way.
          const err = new Error(j.error.message || 'rpc error');
          err.selector = j.error.data || (String(j.error.message || '').match(/0x[0-9a-fA-F]{8}/) || [])[0];
          throw err;
        }
        rpcUrl = url;
        return j.result;
      } catch (e) {
        lastErr = e;
        await new Promise((res) => setTimeout(res, 800));
      }
    }
  }
  throw lastErr;
}

// eth_call that keeps the revert data instead of throwing it away — the revert
// selector is the point of section 4.
async function call(to, data, from) {
  const tx = { to, data };
  if (from) tx.from = from;
  try {
    const result = await rpc('eth_call', [tx, 'latest']);
    return { ok: true, result };
  } catch (e) {
    const m = String(e.message || e);
    const hex = e.selector || (m.match(/0x[0-9a-fA-F]{8}/) || [])[0];
    return { ok: false, message: m, selector: hex };
  }
}

const short = (a) => a.slice(0, 6) + '...' + a.slice(-4);
const n = (h) => Number(BigInt(h));
const line = (label, value, note) =>
  console.log('  ' + label.padEnd(34) + String(value) + (note ? '  ' + note : ''));
const head = (t) => console.log('\n[' + t + ']');
const revert = (r) =>
  r.ok ? 'unexpected success' : 'reverted ' + (r.selector || '?') + '  ' + (ERRORS[r.selector] || '');

console.log('OneDraw — read-only proof run · BNB Chain mainnet');
console.log('contract  ' + ADDR);

// 1 ── the contract itself
head('1  the contract');
const code = await rpc('eth_getCode', [ADDR, 'latest']);
line('runtime bytecode', ((code.length - 2) / 2).toLocaleString('en-US') + ' bytes');
const ownerCall = await call(ADDR, ethers.id('owner()').slice(0, 10));
line('owner()', ownerCall.ok ? 'returns ' + ownerCall.result : 'reverts  ->  no owner');
const names = dep.abi.filter((f) => f.type === 'function').map((f) => f.name);
const forbidden = ['owner', 'withdraw', 'sweep', 'upgradeTo', 'setAdmin', 'pause'];
line('admin-ish functions in ABI', forbidden.filter((f) => names.includes(f)).join(', ') || 'none');

// 2 ── a finished draw
head('2  draw #1 — finished');
const d1 = iface.decodeFunctionResult('draws', await rpc('eth_call', [{ to: ADDR, data: iface.encodeFunctionData('draws', [1]) }, 'latest']));
const entrants1 = iface.decodeFunctionResult('entrants', await rpc('eth_call', [{ to: ADDR, data: iface.encodeFunctionData('entrants', [1]) }, 'latest']))[0];
const winners1 = [];
for (const e of entrants1) {
  const w = await rpc('eth_call', [{ to: ADDR, data: iface.encodeFunctionData('isWinner', [1, e]) }, 'latest']);
  if (n(w) === 1) winners1.push(e.toLowerCase());
}
line('entries', Number(d1[6]));
line('winners', Number(d1[5]));
line('settled', d1[7]);
line('listed on chain', entrants1.map((e) => (winners1.includes(e.toLowerCase()) ? short(e) + ' *' : short(e))).join('  '));

// 3 ── a draw that is open right now
head('3  draw #2 — open now');
const d2 = iface.decodeFunctionResult('draws', await rpc('eth_call', [{ to: ADDR, data: iface.encodeFunctionData('draws', [2]) }, 'latest']));
const closeBlock = Number(d2[3]);
const latest = await rpc('eth_blockNumber', []);
const latestN = parseInt(latest, 16);
const blk = await rpc('eth_getBlockByNumber', [latest, false]);
const nowS = parseInt(blk.timestamp, 16);
const etaS = nowS + Math.max(0, closeBlock - latestN) * 0.45; // BSC ~0.45 s/block
const remainBlocks = Math.max(0, closeBlock - latestN);
line('slots', Number(d2[5]));
line('entries so far', Number(d2[6]));
line('closes at block', closeBlock, '(in ~' + remainBlocks.toLocaleString('en-US') + ' blocks, ~' + (remainBlocks * 0.45 / 86400).toFixed(1) + ' days)');
line('estimated close', new Date(etaS * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC');

// 4 ── the paths the contract refuses
head('4  what the contract refuses');
const loser = entrants1.find((e) => !winners1.includes(e.toLowerCase()));
const r1 = await call(ADDR, iface.encodeFunctionData('claim', [1]), loser);
line('claim(draw 1) by a non-winner', revert(r1));

// A winner who already took the prize: the second attempt is refused too.
let claimedWinner = null;
for (const w of winners1) {
  const c = await rpc('eth_call', [{ to: ADDR, data: iface.encodeFunctionData('claimed', [1, w]) }, 'latest']);
  if (n(c) === 1) { claimedWinner = w; break; }
}
if (claimedWinner) {
  const r2 = await call(ADDR, iface.encodeFunctionData('claim', [1]), claimedWinner);
  line('claim(draw 1) twice by a winner', revert(r2));
} else {
  line('claim(draw 1) twice by a winner', 'no winner has claimed yet — skipped');
}

const r3 = await call(ADDR, iface.encodeFunctionData('enter', [2]), NOBODY);
line('enter(draw 2) with no Agent ID', revert(r3));

// 5 ── the part other projects can reuse
head('5  the reusable part (a public view)');
const v1 = await rpc('eth_call', [{ to: ADDR, data: iface.encodeFunctionData('isVerifiedAgent', [A]) }, 'latest']);
const v2 = await rpc('eth_call', [{ to: ADDR, data: iface.encodeFunctionData('isVerifiedAgent', [NOBODY]) }, 'latest']);
line('isVerifiedAgent(' + short(A) + ')', n(v1) === 1);
line('isVerifiedAgent(' + short(NOBODY) + ')', n(v2) === 1);

console.log('\nrpc  ' + rpcUrl);
console.log('All of the above is eth_call / eth_getCode. Nothing was signed, nothing was spent.\n');
