// Thin wrapper around the Binance Agentic Wallet CLI.
//
// Why this exists rather than just shelling out to `baw`:
//   the CLI takes the contract initcode as a *command line argument*, and on Windows
//   `cmd` truncates at 8191 characters. A 5.3 KB contract is ~10.7 KB of hex, so the
//   deploy silently breaks. Calling the node entry point directly goes through
//   CreateProcess instead (32k limit), which is enough.
//
// Configuration (all optional, no secrets are stored here):
//   BAW_JS   absolute path to @binance/agentic-wallet/dist/index.js  (preferred)
//   BAW_BIN  binary name/path, used when BAW_JS is not set
//   BAW_ENVS directory holding one wallet environment per subdirectory
//            (default: ~/.baw-envs)
//
// A "wallet environment" is just a directory that baw uses as HOME, so that each
// wallet keeps its own session. Nothing sensitive lives in this repo.

import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const BAW_JS = process.env.BAW_JS || '';
const BAW_BIN = process.env.BAW_BIN || 'baw';
const BAW_ENVS = process.env.BAW_ENVS || path.join(os.homedir(), '.baw-envs');

/** Path of a wallet environment, e.g. envDir('wallet-a'). */
export function envDir(name) {
  const override = process.env['BAW_ENV_' + name.toUpperCase().replace(/-/g, '_')];
  return override || path.join(BAW_ENVS, name);
}

/** Address of the wallet whose session lives in `dir`, for one chain. */
export function whoami(dir, binanceChainId = '56') {
  const r = baw(['wallet', 'address', '--json'], dir);
  const list = (r && r.data && r.data.addresses) || [];
  const hit = list.find(a => String(a.binanceChainId) === String(binanceChainId));
  if (hit && hit.address) return hit.address;
  const evm = list.find(a => (a.address || '').startsWith('0x'));
  if (evm) return evm.address;
  throw new Error('no wallet session in ' + dir + ' — run `baw auth signin` there first');
}

/** Run a baw subcommand and return its parsed JSON payload. */
export function baw(args, dir, timeout = 420_000) {
  const env = { ...process.env, USERPROFILE: dir, HOME: dir };
  for (const k of ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'NODE_USE_ENV_PROXY']) {
    delete env[k];
  }
  const opts = { encoding: 'utf8', env, timeout, maxBuffer: 20 * 1024 * 1024 };
  try {
    const out = BAW_JS
      ? execFileSync(process.execPath, [BAW_JS, ...args], opts)
      : execFileSync(BAW_BIN, args, { ...opts, shell: process.platform === 'win32' });
    return JSON.parse(out.slice(out.indexOf('{')));
  } catch (e) {
    const s = (e.stdout || '') + (e.stderr || '');
    const i = s.indexOf('{');
    if (i >= 0) {
      try { return JSON.parse(s.slice(i)); } catch { /* fall through */ }
    }
    return { success: false, error: { message: String(e.message).slice(0, 300) } };
  }
}
