import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBedrockChatModel,
  toBedrockChatModelOptions
} from '../src/langchain/aws-client';
import { resolveBedrockConfig } from '../src/config';

test('resolveBedrockConfig reads Bedrock configuration from environment', () => {
  const config = resolveBedrockConfig({
    BEDROCK_AWS_REGION: 'us-west-2',
    BEDROCK_AWS_ACCESS_KEY_ID: 'access',
    BEDROCK_AWS_SECRET_ACCESS_KEY: 'secret',
    BEDROCK_AWS_SESSION_TOKEN: 'session',
    BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    region: 'us-west-2',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    sessionToken: 'session',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  });
});

test('resolveBedrockConfig fails fast when configuration is missing', () => {
  assert.throws(
    () =>
      resolveBedrockConfig({
        BEDROCK_AWS_REGION: 'us-west-2'
      } as NodeJS.ProcessEnv),
    /Missing Bedrock configuration/
  );
});

test('createBedrockChatModel passes configuration through to ChatBedrockConverse', () => {
  const options = toBedrockChatModelOptions({
    region: 'us-east-1',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    sessionToken: 'session',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  });

  assert.deepEqual(options, {
    model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'access',
      secretAccessKey: 'secret',
      sessionToken: 'session'
    }
  });

  const model = createBedrockChatModel({
    region: 'us-east-1',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    sessionToken: 'session',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  });

  assert.equal(model.constructor.name, 'ChatBedrockConverse');
});
