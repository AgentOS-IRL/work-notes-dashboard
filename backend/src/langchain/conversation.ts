import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { Note } from '../notes-repository';
import { createNoteTools } from './note-tools';
import { createDefaultChatModel } from './index';
import type { NotesRepository } from '../notes-repository';

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatTurn[];
}

export interface ChatResponse {
  assistantMessage: ChatTurn;
  changedNoteIds: number[];
  notesChanged: boolean;
}

export interface ConversationService {
  replyToConversation(request: ChatRequest): Promise<ChatResponse>;
}

interface ConversationModel {
  bindTools(tools: unknown[], options?: Record<string, unknown>): {
    invoke(messages: BaseMessage[]): Promise<BaseMessage>;
  };
}

type ToolResult = Record<string, unknown> & {
  note?: Note;
  notes?: Note[];
};

const MAX_TOOL_LOOPS = 5;
const NOTE_TOOL_NAMES = new Set(['create_note', 'get_note', 'list_notes', 'update_note']);

const SYSTEM_INSTRUCTION = [
  'You are a work notes assistant inside a split-view dashboard.',
  'Your job is to improve the notes collection as the conversation continues.',
  'Use the available tools to inspect existing notes before creating duplicates.',
  'Prefer creating or updating notes with tool calls instead of inventing a separate persistence path.',
  'When the user asks for a note draft, summary, refinement, or follow-up, turn that into a note change when appropriate.',
  'After changing a note, briefly tell the user what you changed.'
].join(' ');

function toBaseMessages(messages: ChatTurn[]): BaseMessage[] {
  return messages.map((message) =>
    message.role === 'user'
      ? new HumanMessage(message.content)
      : new AIMessage(message.content)
  );
}

function extractAssistantText(message: BaseMessage) {
  if (typeof message.content === 'string') {
    return message.content.trim();
  }

  const text = Array.isArray(message.content)
    ? message.content
        .map((block) => {
          if (typeof block === 'string') {
            return block;
          }

          if (
            block &&
            typeof block === 'object' &&
            'text' in block &&
            typeof block.text === 'string'
          ) {
            return block.text;
          }

          return '';
        })
        .join('')
        .trim()
    : '';

  return text;
}

function stringifyToolResult(result: ToolResult) {
  return JSON.stringify(result);
}

function collectChangedNoteIds(toolName: string, result: ToolResult) {
  if (toolName === 'create_note' || toolName === 'update_note') {
    return result.note ? [result.note.id] : [];
  }

  return [];
}

function isNoteToolName(toolName: string): toolName is 'create_note' | 'get_note' | 'list_notes' | 'update_note' {
  return NOTE_TOOL_NAMES.has(toolName);
}

async function invokeTool(
  toolName: string,
  toolArgs: unknown,
  tools: ReturnType<typeof createNoteTools>
) {
  switch (toolName) {
    case 'create_note':
      return tools.createNoteTool.invoke(toolArgs as never);
    case 'get_note':
      return tools.getNoteTool.invoke(toolArgs as never);
    case 'list_notes':
      return tools.listNotesTool.invoke(toolArgs as never);
    case 'update_note':
      return tools.updateNoteTool.invoke(toolArgs as never);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

export function createConversationService(options: {
  repository: NotesRepository;
  model?: ConversationModel;
}): ConversationService {
  const tools = createNoteTools(options.repository);
  const model = options.model ?? (createDefaultChatModel() as unknown as ConversationModel);
  const modelWithTools = model.bindTools([
    tools.createNoteTool,
    tools.getNoteTool,
    tools.listNotesTool,
    tools.updateNoteTool
  ]);

  return {
    async replyToConversation(request: ChatRequest): Promise<ChatResponse> {
      const baseMessages = [new SystemMessage(SYSTEM_INSTRUCTION), ...toBaseMessages(request.messages)];
      const changedNoteIds = new Set<number>();
      let messages: BaseMessage[] = baseMessages;

      for (let loopIndex = 0; loopIndex < MAX_TOOL_LOOPS; loopIndex += 1) {
        const assistantReply = await modelWithTools.invoke(messages);
        messages = [...messages, assistantReply];

        const toolCalls = AIMessage.isInstance(assistantReply) ? assistantReply.tool_calls ?? [] : [];
        if (toolCalls.length === 0) {
          const reply = extractAssistantText(assistantReply);
          if (!reply) {
            throw new Error('The assistant returned an empty response.');
          }

          return {
            assistantMessage: {
              role: 'assistant',
              content: reply
            },
            changedNoteIds: [...changedNoteIds],
            notesChanged: changedNoteIds.size > 0
          };
        }

        for (const toolCall of toolCalls) {
          const toolName = toolCall.name;
          if (!isNoteToolName(toolName)) {
            messages = [
              ...messages,
              new ToolMessage(
                `Unknown tool: ${toolName}`,
                toolCall.id ?? `${toolName}-${loopIndex}`,
                toolName
              )
            ];
            continue;
          }

          try {
            const result = (await invokeTool(toolName, toolCall.args, tools)) as ToolResult;
            for (const changedNoteId of collectChangedNoteIds(toolName, result)) {
              changedNoteIds.add(changedNoteId);
            }

            messages = [
              ...messages,
              new ToolMessage(
                stringifyToolResult(result),
                toolCall.id ?? `${toolName}-${loopIndex}`,
                toolName
              )
            ];
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Tool execution failed.';
            messages = [
              ...messages,
              new ToolMessage(message, toolCall.id ?? `${toolName}-${loopIndex}`, toolName)
            ];
          }
        }
      }

      throw new Error('The conversation did not finish after several tool calls.');
    }
  };
}
