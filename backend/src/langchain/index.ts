import { resolveLLMConfig } from '../config';
import { createBedrockChatModel } from './aws-client';
import { createCodexChatModel } from './codex-client';

export { createBedrockChatModel, createDefaultBedrockChatModel } from './aws-client';
export { createCodexChatModel, ChatCodex } from './codex-client';

export function createDefaultChatModel() {
  const config = resolveLLMConfig();
  console.log('LLM Provider:', config.provider);
  if (config.provider === 'codex') {
    return createCodexChatModel(config.codex);
  }
  return createBedrockChatModel(config.bedrock);
}

export {
  createConversationService,
  type ChatRequest,
  type ChatResponse,
  type ChatTurn,
  type ConversationService
} from './conversation';
export { createNoteTools } from './note-tools';
