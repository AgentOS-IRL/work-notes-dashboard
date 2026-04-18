import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_CODEX_BASE_URL,
  DEFAULT_CODEX_MODEL_NAME,
  DEFAULT_CODEX_TIMEOUT,
  getCodexApiKey,
  getCodexAuthPath,
  getCodexCredentials,
  resetCodexCredentialsCache,
  resolveCodexConfig
} from '../../src/config/codex';

const ENV_KEYS = ['CODEX_ACCESS_TOKEN', 'CODEX_ACCOUNT_ID', 'CODEX_MODEL_NAME', 'CODEX_BASE_URL', 'CODEX_TIMEOUT', 'CODEX_AUTH_PATH'] as const;

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<(typeof ENV_KEYS)[number], string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function withEnv<T>(
  env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => T
) {
  const snapshot = snapshotEnv();

  for (const key of ENV_KEYS) {
    const value = env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    restoreEnv(snapshot);
    resetCodexCredentialsCache();
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
}

function withPatchedHomedir<T>(homedir: string, fn: () => T) {
  const originalHomedir = os.homedir;
  (os as typeof os & { homedir: () => string }).homedir = () => homedir;

  try {
    return fn();
  } finally {
    (os as typeof os & { homedir: () => string }).homedir = originalHomedir;
  }
}

test('resolveCodexConfig returns defaults when env is unset', () => {
  withEnv(
    {
      CODEX_ACCESS_TOKEN: undefined,
      CODEX_ACCOUNT_ID: undefined,
      CODEX_MODEL_NAME: undefined,
      CODEX_BASE_URL: undefined,
      CODEX_TIMEOUT: undefined,
      CODEX_AUTH_PATH: undefined
    },
    () => {
      const config = resolveCodexConfig();

      assert.deepEqual(config, {
        authPath: path.join(os.homedir(), '.codex', 'auth.json'),
        accessToken: undefined,
        accountId: undefined,
        modelName: DEFAULT_CODEX_MODEL_NAME,
        baseUrl: DEFAULT_CODEX_BASE_URL,
        timeout: DEFAULT_CODEX_TIMEOUT
      });
    }
  );
});

test('resolveCodexConfig trims explicit env overrides', () => {
  withEnv(
    {
      CODEX_ACCESS_TOKEN: '  token-123  ',
      CODEX_ACCOUNT_ID: '  account-456  ',
      CODEX_MODEL_NAME: '  model-x  ',
      CODEX_BASE_URL: '  https://example.com/codex  ',
      CODEX_TIMEOUT: '  30000  ',
      CODEX_AUTH_PATH: '  /tmp/custom-auth.json  '
    },
    () => {
      const config = resolveCodexConfig();

      assert.deepEqual(config, {
        authPath: path.resolve('/tmp/custom-auth.json'),
        accessToken: 'token-123',
        accountId: 'account-456',
        modelName: 'model-x',
        baseUrl: 'https://example.com/codex',
        timeout: 30000
      });
    }
  );
});

test('getCodexAuthPath expands ~ prefixes against the current home directory', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-home-'));

  withPatchedHomedir(tempHome, () => {
    withEnv(
      {
        CODEX_AUTH_PATH: '~/nested/auth.json',
        CODEX_ACCESS_TOKEN: undefined,
        CODEX_ACCOUNT_ID: undefined,
        CODEX_MODEL_NAME: undefined,
        CODEX_BASE_URL: undefined,
        CODEX_TIMEOUT: undefined
      },
      () => {
        assert.equal(getCodexAuthPath(), path.join(tempHome, 'nested', 'auth.json'));
      }
    );
  });
});

test('getCodexCredentials reads from a temp auth file and respects cache reloads', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-auth-'));
  const authPath = path.join(tempRoot, 'auth.json');
  writeJsonFile(authPath, { api_key: 'first-token' });

  withEnv({ CODEX_AUTH_PATH: authPath }, () => {
    const first = getCodexCredentials();
    assert.deepEqual(first, { api_key: 'first-token' });
    assert.equal(getCodexApiKey(), 'first-token');

    writeJsonFile(authPath, { api_key: 'second-token' });

    const cached = getCodexCredentials();
    assert.strictEqual(cached, first);
    assert.equal(getCodexApiKey(), 'first-token');

    const reloaded = getCodexCredentials({ reload: true });
    assert.notStrictEqual(reloaded, first);
    assert.deepEqual(reloaded, { api_key: 'second-token' });
    assert.equal(getCodexApiKey(), 'second-token');
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('getCodexApiKey accepts token-based auth files', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-token-auth-'));
  const authPath = path.join(tempRoot, 'auth.json');
  writeJsonFile(authPath, { token: 'token-123' });

  withEnv({ CODEX_AUTH_PATH: authPath }, () => {
    assert.equal(getCodexApiKey(), 'token-123');
    assert.deepEqual(getCodexCredentials(), { token: 'token-123' });
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('getCodexCredentials rejects a missing auth file', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-missing-auth-'));
  const authPath = path.join(tempRoot, 'auth.json');

  withEnv({ CODEX_AUTH_PATH: authPath }, () => {
    assert.throws(() => getCodexCredentials(), /Codex auth file not found/);
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('getCodexCredentials rejects invalid JSON in the auth file', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-invalid-auth-'));
  const authPath = path.join(tempRoot, 'auth.json');
  fs.mkdirSync(path.dirname(authPath), { recursive: true });
  fs.writeFileSync(authPath, '{not-json', 'utf8');

  withEnv({ CODEX_AUTH_PATH: authPath }, () => {
    assert.throws(() => getCodexCredentials(), /Failed to parse/);
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('getCodexCredentials rejects auth files without a supported credential field', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-empty-auth-'));
  const authPath = path.join(tempRoot, 'auth.json');
  writeJsonFile(authPath, {});

  withEnv({ CODEX_AUTH_PATH: authPath }, () => {
    assert.throws(
      () => getCodexCredentials(),
      /must include a non-empty "api_key" or "token" field/
    );
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('getCodexCredentials rejects auth files that only expose tokens.access_token', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-access-token-auth-'));
  const authPath = path.join(tempRoot, 'auth.json');
  writeJsonFile(authPath, {
    tokens: {
      access_token: 'token-123'
    }
  });

  withEnv({ CODEX_AUTH_PATH: authPath }, () => {
    assert.throws(
      () => getCodexCredentials(),
      /must include a non-empty "api_key" or "token" field/
    );
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
