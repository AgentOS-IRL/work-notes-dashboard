import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { NotFoundError, type Note, type NotesRepository } from '../notes-repository';
import { createNoteTools } from './note-tools';
import { createDefaultChatModel } from './index';

export type ChatRole = 'user' | 'assistant';
export type ChatToolCall = Record<string, unknown>;

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  sessionId: string;
  messages: ChatTurn[];
  lockedNoteId?: number | null;
}

export interface ChatResponse {
  assistantMessage: ChatTurn;
  toolCalls: ChatToolCall[];
  createdNoteIds: number[];
  updatedNoteIds: number[];
  changedNoteIds: number[];
  openedNoteIds: number[];
  lockedNoteId?: number | null;
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
const NOTE_TOOL_NAMES = new Set([
  'create_note',
  'get_note',
  'list_notes',
  'open_note',
  'read_note',
  'update_note'
]);

const UNLOCKED_SYSTEM_INSTRUCTION = [
  'You are a work notes assistant inside a split-view dashboard.',
  'Your job is to improve the notes collection as the conversation continues.',
  'Use the available tools to inspect existing notes before creating duplicates.',
  'Prefer list_notes to find candidate notes, then use read_note only when you actually need note content or metadata, especially before the first update in a session.',
  'Use open_note when the user explicitly wants a note shown in the UI.',
  'Prefer creating or updating notes with tool calls instead of inventing a separate persistence path.',
  'When the user asks for a note draft, summary, refinement, or follow-up, turn that into a note change when appropriate.',
  'After changing a note, briefly tell the user what you changed.'
].join(' ');

const LOCKED_SYSTEM_INSTRUCTION = [
  'You are a work notes assistant inside a split-view dashboard.',
  'The conversation is locked to a single note, so treat that note as the active editing target.',
  'You will also receive the current note body as internal context.',
  'Use the available note tools as needed to inspect, update, open, create, or list notes.',
  'After each user message, reorganize and update the note. Such that overall structure is maintained of the note in markdown format keep improving and refining the note. Do not add any conversational filler or pleasantries.'
].join(' ');

function buildSystemInstruction(lockedNoteId: number | null) {
  return lockedNoteId == null ? UNLOCKED_SYSTEM_INSTRUCTION : LOCKED_SYSTEM_INSTRUCTION;
}

function refreshSystemMessage(messages: BaseMessage[], lockedNoteId: number | null) {
  if (messages.length === 0 || !('getType' in messages[0]) || messages[0].getType() !== 'system') {
    return [new SystemMessage(buildSystemInstruction(lockedNoteId)), ...messages];
  }

  const systemInstruction = buildSystemInstruction(lockedNoteId);
  if (messages[0].content === systemInstruction) {
    return messages;
  }

  return [new SystemMessage(systemInstruction), ...messages.slice(1)];
}

function buildLockedNoteContextMessage(note: Note) {
  return new HumanMessage(
    [
      'Current locked note context:',
      `Note id: ${note.id}`,
      `Title: ${note.title}`,
      'Content:',
      note.content
    ].join('\n')
  );
}

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

function collectCreatedNoteIds(toolName: string, result: ToolResult) {
  if (toolName === 'create_note') {
    return result.note ? [result.note.id] : [];
  }

  return [];
}

function collectUpdatedNoteIds(toolName: string, result: ToolResult) {
  if (toolName === 'update_note') {
    return result.note ? [result.note.id] : [];
  }

  return [];
}

function collectOpenedNoteIds(toolName: string, result: ToolResult) {
  if (toolName === 'open_note') {
    return result.note ? [result.note.id] : [];
  }

  return [];
}

function buildOpenNoteAssistantMessage(Ids: number[], pre_fix: string) {
  if (Ids.length === 0) {
    return `${pre_fix} the note.`;
  }

  if (Ids.length === 1) {
    return `${pre_fix} note ${Ids[0]}.`;
  }

  return `${pre_fix} notes ${Ids.join(', ')}.`;
}

function isNoteToolName(toolName: string): toolName is 'create_note' | 'get_note' | 'list_notes' | 'open_note' | 'read_note' | 'update_note' {
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
    case 'read_note':
      return tools.readNoteTool.invoke(toolArgs as never);
    case 'list_notes':
      return tools.listNotesTool.invoke(toolArgs as never);
    case 'open_note':
      return tools.openNoteTool.invoke(toolArgs as never);
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
  const model = options.model ?? (createDefaultChatModel() as unknown as ConversationModel);

  return {
    async replyToConversation(request: ChatRequest): Promise<ChatResponse> {
      const requestLockedNoteId = request.lockedNoteId ?? null;
      let responseLockedNoteId = requestLockedNoteId;
      const tools = createNoteTools(options.repository, {
        sessionId: request.sessionId
      }, {
        lockedNoteId: requestLockedNoteId
      });
      const lockedNoteMessages =
        requestLockedNoteId == null
          ? []
          : (() => {
              const lockedNote = options.repository.getNoteById(requestLockedNoteId);
              if (!lockedNote) {
                throw new NotFoundError(`Note ${requestLockedNoteId} was not found.`);
              }

              return [buildLockedNoteContextMessage(lockedNote)];
            })();
      const baseMessages = [
        new SystemMessage(buildSystemInstruction(requestLockedNoteId)),
        ...lockedNoteMessages,
        ...toBaseMessages(request.messages)
      ];
      const createdNoteIds = new Set<number>();
      const updatedNoteIds = new Set<number>();
      const changedNoteIds = new Set<number>();
      const openedNoteIds = new Set<number>();
      const toolCalls: ChatToolCall[] = [];
      let messages: BaseMessage[] = baseMessages;
      let allowEmptyReplyForOpenNote = false;

      for (let loopIndex = 0; loopIndex < MAX_TOOL_LOOPS; loopIndex += 1) {
        messages = refreshSystemMessage(messages, requestLockedNoteId);
        const modelWithTools = model.bindTools([
          tools.createNoteTool,
          tools.readNoteTool,
          tools.openNoteTool,
          tools.listNotesTool,
          tools.updateNoteTool
        ]);
        const assistantReply = await modelWithTools.invoke(messages);
        messages = [...messages, assistantReply];

        const assistantToolCalls = AIMessage.isInstance(assistantReply) ? assistantReply.tool_calls ?? [] : [];
        const assistantToolCallNames = assistantToolCalls.map((toolCall) => toolCall.name);
        toolCalls.push(...assistantToolCalls.map((toolCall) => ({ ...toolCall })));

        if (assistantToolCalls.length === 0) {
          const reply = extractAssistantText(assistantReply);
          if (!reply) {
            throw new Error(
              `The assistant returned an empty response. ${JSON.stringify({
                content: assistantReply.content,
                additional_kwargs: assistantReply.additional_kwargs,
                response_metadata: assistantReply.response_metadata,
                tool_calls: AIMessage.isInstance(assistantReply) ? assistantReply.tool_calls ?? [] : []
              })}`
            );
          }

          return {
            assistantMessage: {
              role: 'assistant',
              content: reply
            },
            toolCalls,
            createdNoteIds: [...createdNoteIds],
            updatedNoteIds: [...updatedNoteIds],
            changedNoteIds: [...changedNoteIds],
            openedNoteIds: [...openedNoteIds],
            notesChanged: createdNoteIds.size > 0 || updatedNoteIds.size > 0 || changedNoteIds.size > 0
              ? true
              : false,
            ...(responseLockedNoteId == null ? {} : { lockedNoteId: responseLockedNoteId })
          };
        }

        for (const toolCall of assistantToolCalls) {
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
            for (const createdNoteId of collectCreatedNoteIds(toolName, result)) {
              createdNoteIds.add(createdNoteId);
              changedNoteIds.add(createdNoteId);
            }
            for (const updatedNoteId of collectUpdatedNoteIds(toolName, result)) {
              updatedNoteIds.add(updatedNoteId);
              changedNoteIds.add(updatedNoteId);
              if (responseLockedNoteId == null) {
                responseLockedNoteId = updatedNoteId;
              }
            }
            for (const openedNoteId of collectOpenedNoteIds(toolName, result)) {
              openedNoteIds.add(openedNoteId);
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

        allowEmptyReplyForOpenNote =
          assistantToolCalls.length > 0 &&
          (assistantToolCallNames.every((toolName) => toolName === 'open_note') ||
            assistantToolCallNames.every((toolName) => toolName === 'create_note') ||
            assistantToolCallNames.every((toolName) => toolName === 'update_note'));
        if (allowEmptyReplyForOpenNote) {
          let pre_fix = "Opened"
          let Ids = [...openedNoteIds]
          switch (assistantToolCallNames[0]) {
            case 'open_note':
              pre_fix = "Opened"
              Ids = [...openedNoteIds]
              break;
            case 'create_note':
              pre_fix = "Created"
              Ids = [...createdNoteIds]
              break;
            case 'update_note':
              pre_fix = "Updated"
              Ids = [...updatedNoteIds]
              break;
          }
          return {
            assistantMessage: {
              role: 'assistant',
              content: buildOpenNoteAssistantMessage([...Ids], pre_fix)
            },
            toolCalls,
            createdNoteIds: [...createdNoteIds],
            updatedNoteIds: [...updatedNoteIds],
            changedNoteIds: [...changedNoteIds],
            openedNoteIds: [...openedNoteIds],
            notesChanged: createdNoteIds.size > 0 || updatedNoteIds.size > 0 || changedNoteIds.size > 0
              ? true
              : false,
            ...(responseLockedNoteId == null ? {} : { lockedNoteId: responseLockedNoteId })
          };
        }
      }

      throw new Error(`The conversation did not finish after several tool calls. - ${JSON.stringify(toolsCalled)}`);
    }
  };
}
