import { ChatBedrockConverse } from '@langchain/aws';
import { resolveBedrockConfig, type BedrockConfig } from '../config';

export function toBedrockChatModelOptions(config: BedrockConfig) {
  return {
    model: config.modelId,
    region: config.region
  };
}

export function createBedrockChatModel(config: BedrockConfig = resolveBedrockConfig()) {
  return new ChatBedrockConverse(toBedrockChatModelOptions(config));
}
