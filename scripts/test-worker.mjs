import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseEnv } from 'node:util';
import { startTestServices } from './worker-test-services.mjs';
const state = await mkdtemp(join(tmpdir(), 'khun-worker-test-'));
const root = resolve(import.meta.dirname, '..');
const wrangler = join(root, 'node_modules/.bin/wrangler');
let service;
let mocks;
function command(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: root, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${bin} exited with ${code}`)));
  });
}
try {
  const env = parseEnv(await readFile(join(root, 'backend-worker/.dev.vars'), 'utf8'));
  if (!env.INITIAL_SETUP_TOKEN || !env.CONFIG_ENCRYPTION_KEY) throw new Error('Run npm run worker:setup first');
  mocks=await startTestServices();
  await command(wrangler, ['d1', 'migrations', 'apply', 'khun-phaen', '--local', '--persist-to', state, '--config', 'backend-worker/wrangler.jsonc']);
  // Fixed test port is separate from the developer's ordinary local Worker. Never touches remote D1.
  const port = 8798;
  const base = `http://127.0.0.1:${port}`;
  try { await fetch(`${base}/health`); throw new Error(`Port ${port} is in use`); }
  catch (error) { if (!error.cause) throw error; }
  service = spawn(wrangler, ['dev', '--port', String(port), '--persist-to', state,'--test-scheduled','--var',`NOTIFICATION_WEBHOOK_ORIGIN:${mocks.url}`], {
    cwd: join(root, 'backend-worker'), stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Do not print Wrangler startup output: future versions may include local binding values.
  let log = '';
  for (const stream of [service.stdout, service.stderr]) stream.on('data', chunk => { log = (log + chunk.toString()).slice(-8000); });
  let ready = false;
  for (let i = 0; i < 180; i++) {
    if (service.exitCode !== null) throw new Error('Local Worker failed to start; run npm run worker:dev to inspect');
    try { const r = await fetch(`${base}/health`); if (r.ok) { ready = true; break; } } catch {}
    await delay(500);
  }
  if (!ready) throw new Error('Local Worker did not become ready');
  const testEnv={...process.env,WORKER_TEST_URL:base,TEST_FIXTURE_PATH:join(state,'fixture.json'),MOCK_SERVICE_URL:mocks.url,TEST_S3_SECRET:mocks.secret,TEST_STATE:state};
  await command(process.execPath, ['backend-worker/tests/smoke.mjs'], {env:testEnv});
  await command(process.execPath, ['backend-worker/tests/parity.mjs'], {env:testEnv});
  await command(process.execPath, ['backend-worker/tests/contract.mjs'], {env:testEnv});
  await delay(500);
  if (log.includes('Uncaught ')) throw new Error('Local Worker logged an uncaught runtime error during smoke tests');
} finally {
  if (service && service.exitCode === null) {
    service.kill('SIGTERM');
    await Promise.race([new Promise(resolve => service.once('exit', resolve)), delay(5000)]);
    if (service.exitCode === null) service.kill('SIGKILL');
  }
  if(mocks)await mocks.close();
  await rm(state, { recursive: true, force: true });
}
