import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('00 Підготовка: команда prepare створює .env і зберігає наявний ключ', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'harness-env-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  for (const file of ['package.json', '.env.example']) {
    await writeFile(join(temporary, file), await readFile(join(root, file)));
  }
  const prepare = () => {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'prepare'], {
      cwd: temporary, encoding: 'utf8', timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr);
  };
  prepare();
  assert.equal(await readFile(join(temporary, '.env'), 'utf8'),
    await readFile(join(root, '.env.example'), 'utf8'));
  const existing = 'GROQ_API_KEY=offline-test-key\n';
  await writeFile(join(temporary, '.env'), existing);
  prepare();
  assert.equal(await readFile(join(temporary, '.env'), 'utf8'), existing);
});

test('00 Ранбуки: усі теми, локальні посилання, пояснення, перевірки та готовий код доступні', async () => {
  const folder = join(root, 'runbooks');
  const files = (await readdir(folder)).filter(file => /^\d\d(?:b)?-.*\.md$/.test(file)).sort();
  const stages = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '08b', '09', '10', '11', '12'];
  assert.equal(files.length, stages.length);
  for (const [index, file] of files.entries()) {
    assert.equal(file.split('-')[0], stages[index]);
    const content = await readFile(join(folder, file), 'utf8');
    for (const section of ['Що робимо й навіщо', 'Перевірка', 'Готовий код']) {
      assert.ok(content.includes(section), `${file}: немає ${section}`);
    }
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:|#)/.test(match[1])) continue;
      const target = match[1].split('#')[0];
      await access(resolve(dirname(join(folder, file)), decodeURIComponent(target)));
    }
  }
});

async function setupCheck(t, model, apiKey = 'offline-test-key', responseStatus = 200) {
  const temporary = await mkdtemp(join(tmpdir(), 'harness-setup-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const capture = join(temporary, 'request.jsonl');
  const result = spawnSync(process.execPath, [
    '--import', './test/groq.mock.mjs', 'scripts/check-setup.mjs',
  ], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, GROQ_API_KEY: apiKey,
      GROQ_MODEL: model, HARNESS_SETUP_TEST: '1', HARNESS_SETUP_STATUS: String(responseStatus), HARNESS_REQUESTS_PATH: capture },
  });
  assert.doesNotMatch(result.stdout + result.stderr, /offline-test-key/);
  return { result, capture };
}

test('00 API-підготовка: Groq повертає коректний tool call', async (t) => {
  const { result, capture } = await setupCheck(t, 'qwen/qwen3.8-27b');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ключ працює; tool call отримано/);
  const requests = (await readFile(capture, 'utf8')).trim().split('\n');
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0]).model, 'qwen/qwen3.8-27b');
  assert.ok(JSON.parse(requests[0]).max_tokens > 0 && JSON.parse(requests[0]).max_tokens < 1000);
});

test('00 API-підготовка: порожній ключ і 429 не запускають прихованих повторів', async (t) => {
  const { result, capture } = await setupCheck(t, 'qwen/qwen3.8-27b', '');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Встав GROQ_API_KEY/);
  await assert.rejects(() => readFile(capture), { code: 'ENOENT' });
  const limited = await setupCheck(t, 'qwen/qwen3.8-27b', 'offline-test-key', 429);
  assert.equal(limited.result.status, 1);
  assert.match(limited.result.stderr, /Досягнуто ліміт Groq/);
  assert.match(limited.result.stderr, /Retry-After: 30/);
  assert.equal((await readFile(limited.capture, 'utf8')).trim().split('\n').length, 1);
  const oversized = await setupCheck(t, 'qwen/qwen3.8-27b', 'offline-test-key', 'too-large');
  assert.equal(oversized.result.status, 1);
  assert.match(oversized.result.stderr, /Зменш maxOutputTokens/);
  assert.doesNotMatch(oversized.result.stderr, /зачекай перед повтором/);
  assert.equal((await readFile(oversized.capture, 'utf8')).trim().split('\n').length, 1);
});
