import path from 'node:path';
import { type CodexConfig, resolveCodexConfig } from './config/codex';

export const defaultDatabasePath = path.resolve(process.cwd(), 'data', 'notes.sqlite');

export function resolveDatabasePath(databasePath = process.env.SQLITE_DB_PATH ?? defaultDatabasePath) {
  return path.resolve(databasePath);
}

export interface BedrockConfig {
  region: string;
  modelId: string;
}

export type LLMProvider = 'bedrock' | 'codex';

export interface LLMConfig {
  provider: LLMProvider;
  bedrock?: BedrockConfig;
  codex?: CodexConfig;
}

function requireEnv(name: string, value: string | undefined, missing: string[]) {
  const trimmed = value?.trim();
  if (!trimmed) {
    missing.push(name);
    return '';
  }

  return trimmed;
}

export function resolveBedrockConfig(env = process.env): BedrockConfig {
  const missing: string[] = [];
  const region = requireEnv('BEDROCK_AWS_REGION', env.BEDROCK_AWS_REGION, missing);
  const modelId = requireEnv('BEDROCK_MODEL_ID', env.BEDROCK_MODEL_ID, missing);

  if (missing.length > 0) {
    throw new Error(`Missing Bedrock configuration: ${missing.join(', ')}`);
  }

  return {
    region,
    modelId
  };
}

export function resolveLLMConfig(env = process.env): LLMConfig {
  const provider = (env.LLM_PROVIDER || 'bedrock') as LLMProvider;

  if (provider === 'codex') {
    return {
      provider,
      codex: resolveCodexConfig(env)
    };
  }

  if (provider === 'bedrock') {
    return {
      provider,
      bedrock: resolveBedrockConfig(env)
    };
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}
