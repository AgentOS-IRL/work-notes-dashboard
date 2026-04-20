import assert from 'node:assert/strict';
import test from 'node:test';

import { ChatBedrockConverse } from '@langchain/aws';

import { resolveBedrockConfig } from '../src/config';
import { createBedrockChatModel, toBedrockChatModelOptions } from '../src/langchain/aws-client';

test('resolveBedrockConfig reads the required Bedrock configuration from environment', () => {
  const config = resolveBedrockConfig({
    BEDROCK_AWS_REGION: '  us-west-2  ',
    BEDROCK_MODEL_ID: '  anthropic.claude-3-5-sonnet-20240620-v1:0  '
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    region: 'us-west-2',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  });
});

test('resolveBedrockConfig preserves legacy Bedrock AWS credentials when provided', () => {
  const config = resolveBedrockConfig({
    BEDROCK_AWS_REGION: 'us-west-2',
    BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    BEDROCK_AWS_ACCESS_KEY_ID: '  access  ',
    BEDROCK_AWS_SECRET_ACCESS_KEY: '  secret  ',
    BEDROCK_AWS_SESSION_TOKEN: '  session  '
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    region: 'us-west-2',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    sessionToken: 'session'
  });
});

test('resolveBedrockConfig fails fast when required configuration is missing', () => {
  assert.throws(
    () =>
      resolveBedrockConfig({
        BEDROCK_AWS_REGION: 'us-west-2'
      } as NodeJS.ProcessEnv),
    { message: 'Missing Bedrock configuration: BEDROCK_MODEL_ID' }
  );
});

test('toBedrockChatModelOptions only passes model and region', () => {
  const options = toBedrockChatModelOptions({
    region: 'us-east-1',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  });

  assert.deepEqual(options, {
    model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    region: 'us-east-1'
  });
});

test('toBedrockChatModelOptions passes through explicit legacy AWS credentials', () => {
  const options = toBedrockChatModelOptions({
    region: 'us-east-1',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    sessionToken: 'session'
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
});

test('createBedrockChatModel returns ChatBedrockConverse without explicit AWS credentials', () => {
  const model = createBedrockChatModel({
    region: 'us-east-1',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  });

  assert.equal(model instanceof ChatBedrockConverse, true);
  assert.deepEqual(model.lc_kwargs, {
    callbacks: undefined,
    model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    region: 'us-east-1'
  });
});
