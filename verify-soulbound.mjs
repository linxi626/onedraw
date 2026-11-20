// Measures the claim the whole project rests on: is the Agent ID actually non-transferable?
//
//   node verify-soulbound.mjs                # last 4,000,000 blocks
//   node verify-soulbound.mjs --blocks 8000000
//
// It walks every ERC-721 Transfer event the registry ever emitted in the window and
// splits them into mints (from = 0x0) and address-to-address moves. A soulbound token
// has a large mint count and exactly zero moves. No API key, no indexer, just eth_getLogs.
//
// 50,000-block chunks are deliberate: bsc-dataseed rejects wider ranges with
// "limit exceeded", bsc-rpc.publicnode tolerates ~50k.
const RPC = process.env.BSC_RPC || 'https://bsc-rpc.publicnode.com';
const AID = process.env.AGENT_ID || '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO = '0x' + '0'.repeat(64);

const i = process.argv.indexOf('--blocks');
const WINDOW = i >= 0 ? Number(process.argv[i + 1]) : 4_000_000;
const STEP = 50_000;

async function rpc(method, params) {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(RPC, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { if (a === 4) throw e; await new Promise(r => setTimeout(r, 1000)); }
  }
}

const head = parseInt(await rpc('eth_blockNumber', []), 16);
const start = Math.max(0, head - WINDOW);
const fromBlock = await rpc('eth_getBlockByNumber', ['0x' + start.toString(16), false]);
const since = fromBlock ? new Date(parseInt(fromBlock.timestamp, 16) * 1000).toISOString().slice(0, 10) : '?';

console.log(`registry ${AID}`);
console.log(`blocks   ${start} → ${head}  (${WINDOW.toLocaleString()} blocks, since ${since})`);
console.log(`rpc      ${RPC}\n`);

let mints = 0, moves = 0, failed = 0, burn = 0;
const samples = [];

for (let s = start; s <= head; s += STEP) {
  const e = Math.min(s + STEP - 1, head);
  try {
    const logs = await rpc('eth_getLogs', [{
      address: AID, fromBlock: '0x' + s.toString(16), toBlock: '0x' + e.toString(16), topics: [TRANSFER]
    }]);
    for (const l of logs) {
      const from = l.topics[1], to = l.topics[2];
      if (from === ZERO) { mints++; continue; }
      if (to === ZERO) { burn++; continue; }
      moves++;
      if (samples.length < 10) {
        samples.push(`0x${from.slice(-40)} → 0x${to.slice(-40)}  token ${BigInt(l.topics[3])}  block ${parseInt(l.blockNumber, 16)}`);
      }
    }
    process.stderr.write(`\r  scanned ${((e - start) / (head - start) * 100).toFixed(0)}%`);
  } catch { failed++; }
}
process.stderr.write('\n\n');

console.log(`mints                 ${mints}`);
console.log(`address → address     ${moves}`);
console.log(`burns                 ${burn}`);
console.log(`failed chunks         ${failed}`);
if (samples.length) { console.log('\nmoves found:'); samples.forEach(s => console.log('  ' + s)); }
console.log(moves === 0 && failed === 0
  ? '\nRESULT: zero transfers between addresses across the whole window — the token is soulbound in practice.'
  : moves === 0
    ? '\nRESULT: zero transfers found, but some chunks failed — rerun or widen retries before quoting this.'
    : '\nRESULT: the token DOES move. The "one address = one person" assumption would need re-examination.');
