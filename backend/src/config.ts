import path from 'node:path';

export const defaultDatabasePath = path.resolve(process.cwd(), 'data', 'notes.sqlite');

export function resolveDatabasePath(databasePath = process.env.SQLITE_DB_PATH ?? defaultDatabasePath) {
  return path.resolve(databasePath);
}

export interface BedrockConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  modelId: string;
}

export interface CodexConfig {
  accessToken?: string;
  accountId?: string;
  modelName?: string;
  baseUrl?: string;
  timeout?: number;
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

function resolveOptionalAwsCredentials(env: NodeJS.ProcessEnv) {
  const accessKeyId = env.BEDROCK_AWS_ACCESS_KEY_ID?.trim() || undefined;
  const secretAccessKey = env.BEDROCK_AWS_SECRET_ACCESS_KEY?.trim() || undefined;
  const sessionToken = env.BEDROCK_AWS_SESSION_TOKEN?.trim() || undefined;

  if (!accessKeyId && !secretAccessKey && !sessionToken) {
    return {};
  }

  const missing: string[] = [];
  if (!accessKeyId) {
    missing.push('BEDROCK_AWS_ACCESS_KEY_ID');
  }
  if (!secretAccessKey) {
    missing.push('BEDROCK_AWS_SECRET_ACCESS_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `BEDROCK_AWS_SESSION_TOKEN and explicit Bedrock credentials require ${missing.join(', ')}`
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {})
  };
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
    modelId,
    ...resolveOptionalAwsCredentials(env)
  };
}

export function resolveCodexConfig(env = process.env): CodexConfig {
  return {
    accessToken: env.CODEX_ACCESS_TOKEN?.trim() || undefined,
    accountId: env.CODEX_ACCOUNT_ID?.trim() || undefined,
    modelName: env.CODEX_MODEL_NAME,
    baseUrl: env.CODEX_BASE_URL,
    timeout: env.CODEX_TIMEOUT ? parseInt(env.CODEX_TIMEOUT, 10) : undefined
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
