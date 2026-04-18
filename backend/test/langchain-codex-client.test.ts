import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AIMessage } from '@langchain/core/messages';

import { resolveCodexConfig, resolveLLMConfig } from '../src/config';
import { createCodexChatModel, createDefaultChatModel, ChatCodex } from '../src/langchain';

const ENV_KEYS = [
  'LLM_PROVIDER',
  'CODEX_ACCESS_TOKEN',
  'CODEX_ACCOUNT_ID',
  'CODEX_MODEL_NAME',
  'CODEX_BASE_URL',
  'CODEX_TIMEOUT',
  'BEDROCK_AWS_REGION',
  'BEDROCK_MODEL_ID',
  'CODEX_AUTH_PATH'
] as const;

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
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
}

function makeJwt(accountId: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ account_id: accountId })).toString('base64url');
  return `${header}.${payload}.signature`;
}

test('resolveCodexConfig reads Codex configuration from environment', () => {
  const config = resolveCodexConfig({
    CODEX_ACCESS_TOKEN: 'token-123',
    CODEX_ACCOUNT_ID: 'account-456',
    CODEX_MODEL_NAME: 'gpt-5.4-mini',
    CODEX_BASE_URL: 'https://test.com/codex',
    CODEX_TIMEOUT: '30000'
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    accessToken: 'token-123',
    accountId: 'account-456',
    modelName: 'gpt-5.4-mini',
    baseUrl: 'https://test.com/codex',
    timeout: 30000
  });
  assert.equal(typeof config.timeout, 'number');
});

test('resolveCodexConfig returns undefined fields when env is missing', () => {
  const config = resolveCodexConfig({} as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    accessToken: undefined,
    accountId: undefined,
    modelName: undefined,
    baseUrl: undefined,
    timeout: undefined
  });
});

test('resolveLLMConfig chooses the codex provider based on LLM_PROVIDER', () => {
  const config = resolveLLMConfig({
    LLM_PROVIDER: 'codex',
    CODEX_ACCESS_TOKEN: 'token',
    CODEX_ACCOUNT_ID: 'account',
    CODEX_MODEL_NAME: 'gpt-5.4-mini',
    CODEX_BASE_URL: 'https://example.com/codex',
    CODEX_TIMEOUT: '45000'
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    provider: 'codex',
    codex: {
      accessToken: 'token',
      accountId: 'account',
      modelName: 'gpt-5.4-mini',
      baseUrl: 'https://example.com/codex',
      timeout: 45000
    }
  });
});

test('resolveLLMConfig chooses the bedrock provider based on LLM_PROVIDER', () => {
  const config = resolveLLMConfig({
    LLM_PROVIDER: 'bedrock',
    BEDROCK_AWS_REGION: 'us-east-1',
    BEDROCK_MODEL_ID: 'claude-3'
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    provider: 'bedrock',
    bedrock: {
      region: 'us-east-1',
      modelId: 'claude-3'
    }
  });
});

test('resolveLLMConfig rejects an unknown provider with a clear error', () => {
  assert.throws(
    () =>
      resolveLLMConfig({
        LLM_PROVIDER: 'invalid-provider'
      } as NodeJS.ProcessEnv),
    { message: 'Unknown LLM provider: invalid-provider' }
  );
});

test('createCodexChatModel creates a ChatCodex instance', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-codex-model-'));
  const authPath = path.join(tempRoot, 'auth.json');
  const token = makeJwt('account-123');
  writeJsonFile(authPath, { token });

  try {
    withEnv(
      {
        CODEX_AUTH_PATH: authPath,
        CODEX_ACCESS_TOKEN: undefined,
        CODEX_ACCOUNT_ID: undefined
      },
      () => {
        const model = createCodexChatModel({
          modelName: 'test-model'
        });

        assert.equal(model instanceof ChatCodex, true);
        assert.equal(model.authPath, authPath);
        assert.equal(model.accessToken, token);
        assert.equal(model.accountId, 'account-123');
        assert.equal(model.modelName, 'test-model');
      }
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('createCodexChatModel accepts explicit config without Codex env vars', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-explicit-codex-'));
  const authPath = path.join(tempRoot, 'auth.json');
  const token = makeJwt('explicit-account');
  writeJsonFile(authPath, { token });

  try {
    withEnv(
      {
        CODEX_ACCESS_TOKEN: undefined,
        CODEX_ACCOUNT_ID: undefined,
        CODEX_AUTH_PATH: undefined
      },
      () => {
        const model = createCodexChatModel({
          authPath,
          modelName: 'explicit-model',
          baseUrl: 'https://example.com/codex',
          timeout: 1234
        });

        assert.equal(model instanceof ChatCodex, true);
        assert.equal(model.authPath, authPath);
        assert.equal(model.accessToken, token);
        assert.equal(model.accountId, 'explicit-account');
        assert.equal(model.modelName, 'explicit-model');
        assert.equal(model.baseUrl, 'https://example.com/codex');
        assert.equal(model.timeout, 1234);
      }
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('ChatCodex._generate reconstructs streamed tool calls across SSE chunks', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-codex-stream-'));
  const authPath = path.join(tempRoot, 'auth.json');
  const token = makeJwt('stream-account');
  writeJsonFile(authPath, { token });

  const originalFetch = globalThis.fetch;

  const encodeEvent = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          [
            encodeEvent({
              type: 'response.output_item.added',
              item: {
                type: 'function_call',
                id: 'call-1',
                name: 'list_notes'
              }
            }),
            encodeEvent({
              type: 'response.function_call_arguments.delta',
              item_id: 'call-1',
              delta: '{"filter":'
            }),
            encodeEvent({
              type: 'response.function_call_arguments.delta',
              item_id: 'call-1',
              delta: '"recent"}'
            }),
            'data: [DONE]\n\n'
          ].join('')
        )
      );
      controller.close();
    }
  });

  globalThis.fetch = (async () =>
    new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream'
      }
    })) as typeof fetch;

  try {
    await withEnv(
      {
        CODEX_AUTH_PATH: authPath,
        CODEX_ACCESS_TOKEN: undefined,
        CODEX_ACCOUNT_ID: undefined
      },
      async () => {
        const model = new ChatCodex({
          authPath,
          modelName: 'stream-model'
        });

        assert.equal(model.accessToken, token);
        assert.equal(model.accountId, 'stream-account');

        const result = await (model as unknown as {
          _generate(messages: unknown[], options: { signal?: AbortSignal }): Promise<{
            generations: Array<{ message: AIMessage; text: string }>;
          }>;
        })._generate([], {});

        assert.equal(result.generations[0].text, '');
        assert.deepEqual(result.generations[0].message.tool_calls, [
          {
            type: 'tool_call',
            id: 'call-1',
            name: 'list_notes',
            args: {
              filter: 'recent'
            }
          }
        ]);
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('createDefaultChatModel returns correct model based on provider', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-default-codex-'));
  const authPath = path.join(tempRoot, 'auth.json');
  const token = makeJwt('default-account');
  writeJsonFile(authPath, { token });

  try {
    withEnv(
      {
        LLM_PROVIDER: 'codex',
        CODEX_AUTH_PATH: authPath,
        CODEX_ACCESS_TOKEN: undefined,
        CODEX_ACCOUNT_ID: undefined
      },
      () => {
        const model = createDefaultChatModel();
        assert.equal(model instanceof ChatCodex, true);
      }
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
