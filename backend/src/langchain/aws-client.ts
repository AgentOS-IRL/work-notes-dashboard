import { ChatBedrockConverse } from '@langchain/aws';
import { resolveBedrockConfig, type BedrockConfig } from '../config';

function toAwsCredentials(config: BedrockConfig) {
  if (!config.accessKeyId && !config.secretAccessKey && !config.sessionToken) {
    return undefined;
  }

  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error(
      'Bedrock credentials require both BEDROCK_AWS_ACCESS_KEY_ID and BEDROCK_AWS_SECRET_ACCESS_KEY when either is set.'
    );
  }

  return {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    ...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
  };
}

export function toBedrockChatModelOptions(config: BedrockConfig) {
  const credentials = toAwsCredentials(config);

  return {
    model: config.modelId,
    region: config.region,
    ...(credentials ? { credentials } : {})
  };
}

export function createBedrockChatModel(config: BedrockConfig = resolveBedrockConfig()) {
  return new ChatBedrockConverse(toBedrockChatModelOptions(config));
}

export function createDefaultBedrockChatModel() {
  return createBedrockChatModel(resolveBedrockConfig());
}
