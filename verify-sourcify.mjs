// Verify the deployed contract's source on Sourcify — no API key, no account.
//
//   node verify-sourcify.mjs [address]
//
// Sourcify recompiles the source with the settings recorded in metadata.json and
// compares the result byte-for-byte against the creation and runtime code on chain.
// A result of `exact_match` binds the published file to the deployed bytecode.
//
// Defaults to the address in deployed.json. Uses chain 56 (BNB Chain mainnet).

import fs from 'node:fs';

const CHAIN = 56;
const API = 'https://sourcify.dev/server';
const SRC = 'src/OneDraw.sol';

const addr = process.argv[2] || JSON.parse(fs.readFileSync('deployed.json', 'utf8')).address;
const metadata = JSON.parse(fs.readFileSync('build/metadata.json', 'utf8'));
const body = {
  sources: { [SRC]: fs.readFileSync(SRC, 'utf8') },
  metadata
};

console.log('verifying', addr, 'on chain', CHAIN);

const res = await fetch(`${API}/v2/verify/metadata/${CHAIN}/${addr}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'user-agent': 'onedraw-verify/1.0' },
  body: JSON.stringify(body)
});
const submitted = await res.json();
if (res.status === 409) {
  console.log('already verified:', submitted.message);
  console.log('record      :', `${API}/v2/contract/${CHAIN}/${addr}?fields=all`);
  process.exit(0);
}
if (!res.ok) {
  console.error('submit failed', res.status, submitted);
  process.exit(1);
}

const id = submitted.verificationId;
console.log('verificationId', id);

for (let i = 0; i < 30; i++) {
  const r = await fetch(`${API}/v2/verify/${id}`, { headers: { 'user-agent': 'onedraw-verify/1.0' } });
  const job = await r.json();
  if (job.isJobCompleted) {
    const c = job.contract || {};
    console.log('match       :', c.match);
    console.log('creation    :', c.creationMatch);
    console.log('runtime     :', c.runtimeMatch);
    console.log('verifiedAt  :', c.verifiedAt);
    console.log('record      :', `${API}/v2/contract/${CHAIN}/${addr}?fields=all`);
    process.exit(c.match === 'exact_match' ? 0 : 2);
  }
  await new Promise(r => setTimeout(r, 4000));
}
console.log('still pending — poll', `${API}/v2/verify/${id}`);
