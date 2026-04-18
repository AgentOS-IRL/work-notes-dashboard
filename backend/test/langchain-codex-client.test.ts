import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCodexConfig, resolveLLMConfig } from '../src/config';
import { createCodexChatModel, createDefaultChatModel, ChatCodex } from '../src/langchain';
import { AIMessage } from '@langchain/core/messages';

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
});

test('resolveCodexConfig fails when required configuration is missing', () => {
  assert.throws(
    () => resolveCodexConfig({} as NodeJS.ProcessEnv),
    /Missing Codex configuration/
  );
});

test('resolveLLMConfig chooses provider based on LLM_PROVIDER', () => {
  const bedrockConfig = resolveLLMConfig({
    LLM_PROVIDER: 'bedrock',
    BEDROCK_AWS_REGION: 'us-east-1',
    BEDROCK_MODEL_ID: 'claude-3'
  } as NodeJS.ProcessEnv);
  assert.equal(bedrockConfig.provider, 'bedrock');

  const codexConfig = resolveLLMConfig({
    LLM_PROVIDER: 'codex',
    CODEX_ACCESS_TOKEN: 'token',
    CODEX_ACCOUNT_ID: 'account'
  } as NodeJS.ProcessEnv);
  assert.equal(codexConfig.provider, 'codex');
});

test('createCodexChatModel creates a ChatCodex instance', () => {
  // Use environment variables to satisfy resolveCodexConfig in constructor
  process.env.CODEX_ACCESS_TOKEN = 'test-token';
  process.env.CODEX_ACCOUNT_ID = 'test-account';
  
  const model = createCodexChatModel({
    modelName: 'test-model'
  });
  
  assert.equal(model instanceof ChatCodex, true);
  assert.equal(model.modelName, 'test-model');
  
  delete process.env.CODEX_ACCESS_TOKEN;
  delete process.env.CODEX_ACCOUNT_ID;
});

test('createCodexChatModel accepts explicit config without Codex env vars', () => {
  const originalAccessToken = process.env.CODEX_ACCESS_TOKEN;
  const originalAccountId = process.env.CODEX_ACCOUNT_ID;
  delete process.env.CODEX_ACCESS_TOKEN;
  delete process.env.CODEX_ACCOUNT_ID;

  try {
    const model = createCodexChatModel({
      accessToken: 'explicit-token',
      accountId: 'explicit-account',
      modelName: 'explicit-model'
    });

    assert.equal(model instanceof ChatCodex, true);
    assert.equal(model.accessToken, 'explicit-token');
    assert.equal(model.accountId, 'explicit-account');
    assert.equal(model.modelName, 'explicit-model');
  } finally {
    if (originalAccessToken === undefined) {
      delete process.env.CODEX_ACCESS_TOKEN;
    } else {
      process.env.CODEX_ACCESS_TOKEN = originalAccessToken;
    }

    if (originalAccountId === undefined) {
      delete process.env.CODEX_ACCOUNT_ID;
    } else {
      process.env.CODEX_ACCOUNT_ID = originalAccountId;
    }
  }
});

test('ChatCodex._generate reconstructs streamed tool calls across SSE chunks', async () => {
  const originalFetch = globalThis.fetch;
  const originalAccessToken = process.env.CODEX_ACCESS_TOKEN;
  const originalAccountId = process.env.CODEX_ACCOUNT_ID;
  delete process.env.CODEX_ACCESS_TOKEN;
  delete process.env.CODEX_ACCOUNT_ID;

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
    const model = new ChatCodex({
      accessToken: 'explicit-token',
      accountId: 'explicit-account'
    });

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
  } finally {
    globalThis.fetch = originalFetch;

    if (originalAccessToken === undefined) {
      delete process.env.CODEX_ACCESS_TOKEN;
    } else {
      process.env.CODEX_ACCESS_TOKEN = originalAccessToken;
    }

    if (originalAccountId === undefined) {
      delete process.env.CODEX_ACCOUNT_ID;
    } else {
      process.env.CODEX_ACCOUNT_ID = originalAccountId;
    }
  }
});

test('createDefaultChatModel returns correct model based on provider', () => {
  process.env.LLM_PROVIDER = 'codex';
  process.env.CODEX_ACCESS_TOKEN = 'test-token';
  process.env.CODEX_ACCOUNT_ID = 'test-account';
  
  const model = createDefaultChatModel();
  assert.equal(model instanceof ChatCodex, true);
  
  delete process.env.LLM_PROVIDER;
  delete process.env.CODEX_ACCESS_TOKEN;
  delete process.env.CODEX_ACCOUNT_ID;
});
