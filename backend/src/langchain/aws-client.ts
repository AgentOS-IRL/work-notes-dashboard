import { ChatBedrockConverse } from '@langchain/aws';
import { resolveBedrockConfig, type BedrockConfig } from '../config';

export function createBedrockChatModel(config: BedrockConfig = resolveBedrockConfig()) {
  return new ChatBedrockConverse({
    model: config.modelId,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      ...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
    }
  });
}

export function createDefaultBedrockChatModel() {
  return createBedrockChatModel(resolveBedrockConfig());
}

export function toBedrockChatModelOptions(config: BedrockConfig) {
  return {
    model: config.modelId,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      ...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
    }
  };
}
