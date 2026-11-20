// Open a real draw on BSC mainnet.
//
//   node opendraw.mjs --winners 10 --hours 200      # dry run: prints what would happen
//   node opendraw.mjs --winners 10 --hours 200 --go # actually sends the transaction
//
// The sponsor is the wallet whose BAW session lives in $SPONSOR_ENV (default: wallet-a).
// No NFT is escrowed by default — the draw is honour / off-chain fulfilment, which keeps
// the sponsor from ever having to approve anything.
import { createRequire } from 'node:module';
import { baw, envDir, whoami } from './lib/baw.mjs';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { ethers } = require('ethers');

const RPC = 'https://bsc-dataseed.binance.org';
const CONTRACT = '0x98a4aC5a1Db2Efe4c61130F8B929b076D905Ec1b';
const BLOCK_SECONDS = 0.45;          // measured, not assumed — see README
const MAX_DURATION = 2_000_000;
const MIN_DURATION = 20;

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const GO = argv.includes('--go');
const WINNERS = Number(flag('winners', 10));
const HOURS = Number(flag('hours', 200));
const SPONSOR_ENV = process.env.SPONSOR_ENV || envDir('wallet-a');

const iface = new ethers.Interface([
  'function createDraw(address nft,uint256 tokenId,uint16 winners,uint32 durationBlocks) returns (uint256)',
  'function drawCount() view returns (uint256)',
  'function draws(uint256) view returns (address sponsor,address nft,uint256 tokenId,uint32 closeBlock,uint32 settleBlock,uint16 winners,uint16 entries,bool settled,bool prizeOut)'
]);

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
    } catch (e) { if (i === 5) throw e; await new Promise(r => setTimeout(r, 1200)); }
  }
}

const head = parseInt(await rpc('eth_blockNumber', []), 16);
const count = Number(BigInt(await rpc('eth_call', [{ to: CONTRACT, data: iface.encodeFunctionData('drawCount') }, 'latest'])));

let duration = Math.round(HOURS * 3600 / BLOCK_SECONDS);
if (duration > MAX_DURATION) duration = MAX_DURATION;
if (duration < MIN_DURATION) duration = MIN_DURATION;

const closeBlock = head + duration;
const settleBlock = closeBlock + 1;
const closesAt = new Date(Date.now() + duration * BLOCK_SECONDS * 1000);
const settleBy = new Date(Date.now() + (duration + 256) * BLOCK_SECONDS * 1000);

console.log('contract      ', CONTRACT);
console.log('current block ', head);
console.log('next drawId   ', count);
console.log('winners       ', WINNERS);
console.log('duration      ', duration, 'blocks ≈', (duration * BLOCK_SECONDS / 3600).toFixed(1), 'hours');
console.log('closeBlock    ', closeBlock, '≈', closesAt.toISOString());
console.log('settleBlock   ', settleBlock);
console.log('settle window ', '必须在', settleBy.toISOString(), '之前结算（约 1.9 分钟后过期 → settleLate）');

const data = iface.encodeFunctionData('createDraw', [ethers.ZeroAddress, 0, WINNERS, duration]);

if (!GO) {
  console.log('\n[DRY RUN] calldata =', data.slice(0, 74) + '…');
  console.log('加 --go 才会真正发交易。');
  process.exit(0);
}

const sponsor = whoami(SPONSOR_ENV);
const pv = baw(['contract-call', 'preview', '--binanceChainId', '56',
  '--from', sponsor,
  '--to', CONTRACT, '--value', '0', '--inputData', data, '--gasLimit', '220000', '--json'], SPONSOR_ENV);
if (!pv.success) { console.error('preview failed', JSON.stringify(pv.error).slice(0, 300)); process.exit(1); }

const ex = baw(['contract-call', 'execute', '--requestId', pv.data.requestId, '--json'], SPONSOR_ENV);
if (!ex.success) { console.error('execute failed', JSON.stringify(ex.error).slice(0, 300)); process.exit(1); }
console.log('\ntx', ex.data.txHash);

for (let i = 0; i < 30; i++) {
  const rc = await rpc('eth_getTransactionReceipt', [ex.data.txHash]);
  if (rc) {
    console.log('status', rc.status, 'gas', parseInt(rc.gasUsed, 16), 'block', parseInt(rc.blockNumber, 16));
    break;
  }
  await new Promise(r => setTimeout(r, 2500));
}

const d = await rpc('eth_call', [{ to: CONTRACT, data: iface.encodeFunctionData('draws', [count]) }, 'latest']);
const dec = iface.decodeFunctionResult('draws', d);
console.log('draw', count, 'closeBlock', Number(dec.closeBlock), 'settleBlock', Number(dec.settleBlock), 'winners', Number(dec.winners));
fs.appendFileSync('draws-opened.jsonl', JSON.stringify({
  drawId: count, tx: ex.data.txHash, winners: WINNERS, duration,
  closeBlock: Number(dec.closeBlock), settleBlock: Number(dec.settleBlock)
}) + '\n');
