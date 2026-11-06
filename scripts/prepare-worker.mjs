import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
const root = new URL('../', import.meta.url);
async function read(path) {
  try { return await readFile(new URL(path, root), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}
const source = parseEnv(await read('.env'));
const currentText = await read('backend-worker/.dev.vars');
const current = parseEnv(currentText);
const additions = {};
for (const key of ['STORAGE_URL', 'STORAGE_BUCKET', 'STORAGE_REGION', 'RUSTFS_ACCESS_KEY', 'RUSTFS_SECRET_KEY', 'ALLOWED_ORIGIN']) {
  if (!current[key] && source[key]) additions[key] = source[key];
}
if (!current.CONFIG_ENCRYPTION_KEY) additions.CONFIG_ENCRYPTION_KEY = randomBytes(32).toString("base64");
if (!current.INITIAL_SETUP_TOKEN) additions.INITIAL_SETUP_TOKEN = randomBytes(32).toString('hex');
const lines = Object.entries(additions).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
if (lines.length) await writeFile(new URL('backend-worker/.dev.vars', root), `${currentText.trimEnd()}\n${lines.join('\n')}\n`, { mode: 0o600 });
console.log('Worker local environment prepared. Existing values preserved; secrets were not printed.');
