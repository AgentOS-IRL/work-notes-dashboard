import type { ChatResponse, ChatTurn, ConversationService } from './langchain/conversation';
import { ChatSessionRepository } from './chat-session-repository';
import { generateSessionNameFromOpenRouter } from './langchain/open-router-client';
import { ValidationError } from './notes-repository';

export interface ChatSessionRequest {
  sessionId: string;
  messages: ChatTurn[];
}

export type SessionNameGenerator = (messages: ChatTurn[]) => Promise<string>;

export interface ChatSessionService {
  replyToConversation(request: ChatSessionRequest): Promise<ChatResponse>;
}

export function createChatSessionService(options: {
  repository: ChatSessionRepository;
  conversationService: ConversationService;
  generateSessionName?: SessionNameGenerator;
  nameAfterUserMessages?: number;
}): ChatSessionService {
  const generateSessionName =
    options.generateSessionName ?? generateSessionNameFromOpenRouter;
  const nameAfterUserMessages = options.nameAfterUserMessages ?? 2;

  return {
    async replyToConversation(request: ChatSessionRequest): Promise<ChatResponse> {
      const latestMessage = request.messages.at(-1);

      if (!latestMessage || latestMessage.role !== 'user') {
        throw new ValidationError('A user message must be the last message in the session request.');
      }

      try {
        options.repository.cleanupExpiredData();
      } catch {
        // Retention cleanup is best-effort and must not block the chat reply.
      }

      const response = await options.conversationService.replyToConversation({
        sessionId: request.sessionId,
        messages: request.messages
      });

      const persistedTurn = options.repository.recordConversationTurn(
        request.sessionId,
        latestMessage.content,
        response.assistantMessage.content,
        response.toolCalls
      );

      const session = options.repository.updateSessionMetadata(persistedTurn.session.id, {
        created: response.createdNoteIds,
        updated: response.updatedNoteIds
      });

      const userTurnCount = options.repository.countUserTurns(session.id);
      if (session.name === null && userTurnCount >= nameAfterUserMessages) {
        try {
          const recentMessages = options.repository
            .getRecentMessages(session.id, nameAfterUserMessages * 2)
            .filter((message) => message.role === 'user')
            .slice(-nameAfterUserMessages);

          if (recentMessages.length >= nameAfterUserMessages) {
            const resolvedName = (await generateSessionName(recentMessages)).trim();
            if (resolvedName) {
              options.repository.updateSessionName(session.id, resolvedName);
            }
          }
        } catch (error) {
          console.error(`Failed to generate or update session name for session ${session.id}:`, error);
          // Session naming is best-effort and must never block the chat reply.
        }
      }

      return response;
    }
  };
}
