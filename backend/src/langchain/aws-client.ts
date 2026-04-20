import { ChatBedrockConverse } from '@langchain/aws';
import { resolveBedrockConfig, type BedrockConfig } from '../config';

export function toBedrockChatModelOptions(config: BedrockConfig) {
  const credentials =
    config.accessKeyId && config.secretAccessKey
      ? {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          ...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
        }
      : undefined;

  return {
    model: config.modelId,
    region: config.region,
    ...(credentials ? { credentials } : {})
  };
}

export function createBedrockChatModel(config: BedrockConfig = resolveBedrockConfig()) {
  return new ChatBedrockConverse(toBedrockChatModelOptions(config));
}
