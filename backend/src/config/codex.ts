import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CODEX_AUTH_PATH_ENV = 'CODEX_AUTH_PATH';

export const DEFAULT_CODEX_MODEL_NAME = 'gpt-5.4-mini';
export const DEFAULT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex/responses';
export const DEFAULT_CODEX_TIMEOUT = 60000;

export interface CodexCredentials {
  api_key?: string;
  token?: string;
  [key: string]: unknown;
}

export interface CodexConfig {
  accessToken?: string;
  accountId?: string;
  modelName?: string;
  baseUrl?: string;
  timeout?: number;
  authPath?: string;
}

let cachedCredentials: CodexCredentials | null = null;
let cachedAuthPath: string | null = null;

function expandHome(filePath: string): string {
  if (!filePath.startsWith('~')) {
    return path.resolve(filePath);
  }

  let remainder = filePath.slice(1);
  while (remainder.startsWith(path.sep)) {
    remainder = remainder.slice(1);
  }

  return remainder ? path.join(os.homedir(), remainder) : os.homedir();
}

export function getCodexAuthPath(env = process.env): string {
  const override = env[CODEX_AUTH_PATH_ENV]?.trim();
  if (override) {
    return expandHome(override);
  }

  return path.join(os.homedir(), '.codex', 'auth.json');
}

function ensureFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Codex auth file not found at ${filePath}. Set ${CODEX_AUTH_PATH_ENV} or create ${filePath} with an api_key/token before starting the service.`
    );
  }
}

function parseAuthFile(filePath: string): CodexCredentials {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Codex auth file at ${filePath} must contain a JSON object.`);
    }
    return parsed as CodexCredentials;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

function ensureCredentialKey(creds: CodexCredentials, filePath: string): string {
  const looseCreds = creds as Record<string, unknown>;
  const candidate =
    (typeof creds.api_key === 'string' ? creds.api_key : undefined) ??
    (typeof creds.token === 'string' ? creds.token : undefined) ??
    (typeof looseCreds.apiKey === 'string' ? looseCreds.apiKey : undefined);

  if (!candidate || !candidate.trim()) {
    throw new Error(
      `Codex auth file at ${filePath} must include a non-empty "api_key" or "token" field.`
    );
  }

  return candidate.trim();
}

function loadCredentials(filePath: string): CodexCredentials {
  ensureFileExists(filePath);
  const credentials = parseAuthFile(filePath);
  ensureCredentialKey(credentials, filePath);
  return credentials;
}

function resolveTimeout(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_CODEX_TIMEOUT;
  }

  return parseInt(trimmed, 10);
}

export function resolveCodexConfig(env = process.env): CodexConfig {
  return {
    authPath: getCodexAuthPath(env),
    accessToken: env.CODEX_ACCESS_TOKEN?.trim() || undefined,
    accountId: env.CODEX_ACCOUNT_ID?.trim() || undefined,
    modelName: env.CODEX_MODEL_NAME?.trim() || DEFAULT_CODEX_MODEL_NAME,
    baseUrl: env.CODEX_BASE_URL?.trim() || DEFAULT_CODEX_BASE_URL,
    timeout: resolveTimeout(env.CODEX_TIMEOUT)
  };
}

export function getCodexCredentials(options?: { reload?: boolean }): CodexCredentials {
  const authPath = getCodexAuthPath();
  const shouldReload = options?.reload ?? false;

  if (!shouldReload && cachedCredentials && cachedAuthPath === authPath) {
    return cachedCredentials;
  }

  const credentials = loadCredentials(authPath);
  cachedCredentials = credentials;
  cachedAuthPath = authPath;
  return credentials;
}

export function resetCodexCredentialsCache(): void {
  cachedCredentials = null;
  cachedAuthPath = null;
}

export function getCodexApiKey(): string {
  const credentials = getCodexCredentials();
  const authPath = cachedAuthPath ?? getCodexAuthPath();
  return ensureCredentialKey(credentials, authPath);
}
