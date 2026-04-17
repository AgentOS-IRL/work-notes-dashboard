import path from 'node:path';

export const defaultDatabasePath = path.resolve(process.cwd(), 'data', 'notes.sqlite');

export function resolveDatabasePath(databasePath = process.env.SQLITE_DB_PATH ?? defaultDatabasePath) {
  return path.resolve(databasePath);
}

export interface BedrockConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  modelId: string;
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
  const accessKeyId = requireEnv('BEDROCK_AWS_ACCESS_KEY_ID', env.BEDROCK_AWS_ACCESS_KEY_ID, missing);
  const secretAccessKey = requireEnv(
    'BEDROCK_AWS_SECRET_ACCESS_KEY',
    env.BEDROCK_AWS_SECRET_ACCESS_KEY,
    missing
  );
  const modelId = requireEnv('BEDROCK_MODEL_ID', env.BEDROCK_MODEL_ID, missing);
  const sessionToken = env.BEDROCK_AWS_SESSION_TOKEN?.trim() || undefined;

  if (missing.length > 0) {
    throw new Error(`Missing Bedrock configuration: ${missing.join(', ')}`);
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    modelId
  };
}
