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
  const existing = 'OPENROUTER_API_KEY=offline-test-key\n';
  await writeFile(join(temporary, '.env'), existing);
  prepare();
  assert.equal(await readFile(join(temporary, '.env'), 'utf8'), existing);
});

test('00 Ранбуки: усі теми, локальні посилання, пояснення, перевірки та готовий код доступні', async () => {
  const folder = join(root, 'runbooks');
  const files = (await readdir(folder)).filter(file => /^\d\d-.*\.md$/.test(file)).sort();
  assert.equal(files.length, 13);
  for (const [index, file] of files.entries()) {
    assert.equal(Number(file.slice(0, 2)), index);
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

async function setupCheck(t, model) {
  const temporary = await mkdtemp(join(tmpdir(), 'harness-setup-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const capture = join(temporary, 'request.jsonl');
  const result = spawnSync(process.execPath, [
    '--import', './test/openrouter.mock.mjs', 'scripts/check-setup.mjs',
  ], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, OPENROUTER_API_KEY: 'offline-test-key',
      OPENROUTER_MODEL: model, HARNESS_SETUP_TEST: '1', HARNESS_REQUESTS_PATH: capture },
  });
  assert.doesNotMatch(result.stdout + result.stderr, /offline-test-key/);
  return { result, capture };
}

test('00 API-підготовка: безкоштовна модель повертає коректний tool call', async (t) => {
  const { result, capture } = await setupCheck(t, 'qwen/qwen3.8-27b:free');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ключ працює; tool call отримано/);
  const requests = (await readFile(capture, 'utf8')).trim().split('\n');
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0]).model, 'qwen/qwen3.8-27b:free');
});

test('00 API-підготовка: платний ID відхиляється до виклику моделі', async (t) => {
  const { result, capture } = await setupCheck(t, 'paid/example');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /суфіксом :free/);
  await assert.rejects(() => readFile(capture), { code: 'ENOENT' });
});
