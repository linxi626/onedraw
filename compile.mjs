// Compile OneDraw with solc-js and write everything the other scripts need.
//
//   node compile.mjs
//
// Output (build/):
//   OneDraw.bin        creation bytecode (no constructor args)
//   OneDraw.abi        ABI
//   runtime.txt        deployed bytecode
//   metadata.json      solc metadata — required for source verification
//   std_input.json     the exact standard-JSON input, for reproducibility
//
// Settings are pinned to what is deployed on BNB Chain:
//   solc 0.8.26, optimizer on, 200 runs. Changing them changes the deployed
//   address, because the metadata hash is part of the bytecode.

import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const solc = require('solc');

const SRC = 'src/OneDraw.sol';
const OUT = 'build';

const input = {
  language: 'Solidity',
  sources: { [SRC]: { content: fs.readFileSync(SRC, 'utf8') } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'] }
    }
  }
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));
for (const e of out.errors || []) {
  if (e.severity === 'error') {
    console.error(e.formattedMessage);
    process.exit(1);
  }
}

const c = out.contracts[SRC].OneDraw;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/OneDraw.bin`, c.evm.bytecode.object);
fs.writeFileSync(`${OUT}/OneDraw.abi`, JSON.stringify(c.evm.abi ?? JSON.parse(c.metadata).output.abi, null, 2));
fs.writeFileSync(`${OUT}/runtime.txt`, c.evm.deployedBytecode.object);
fs.writeFileSync(`${OUT}/metadata.json`, c.metadata);
fs.writeFileSync(`${OUT}/std_input.json`, JSON.stringify(input, null, 2));

console.log('solc        :', solc.version());
console.log('creation    :', c.evm.bytecode.object.length / 2, 'bytes');
console.log('runtime     :', c.evm.deployedBytecode.object.length / 2, 'bytes');
console.log('abi entries :', JSON.parse(c.metadata).output.abi.length);
