import {
  BaseChatModel,
  BaseChatModelParams,
  type BaseChatModelCallOptions
} from "@langchain/core/language_models/chat_models";
import {
  BaseMessage,
  ChatMessage,
  AIMessageChunk,
  ToolMessage,
  BaseMessageChunk,
  AIMessage,
  type ToolCallChunk
} from "@langchain/core/messages";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";
import * as fs from "fs";
import { getCodexAuthPath } from "../config/openai";

import { type CodexConfig, resolveCodexConfig } from "../config";
import { z } from "zod";

export interface ChatCodexInput extends BaseChatModelParams, Partial<CodexConfig> {
  authPath?: string;
}

export interface ChatCodexCallOptions extends BaseChatModelCallOptions {
  tools?: BindToolsInput[];
}

export class ChatCodex extends BaseChatModel<ChatCodexCallOptions> {
  accessToken: string;
  accountId: string;
  modelName: string;
  baseUrl: string;
  timeout: number;
  authPath: string;
  tools: BindToolsInput[] = [];

  constructor(fields: ChatCodexInput = {}) {
    super(fields);

    this.authPath = fields.authPath || getCodexAuthPath();
    this.modelName = fields.modelName || "gpt-5.4-mini";
    this.baseUrl = fields.baseUrl || "https://chatgpt.com/backend-api/codex/responses";
    this.timeout = fields.timeout ?? 60000;

    const { accessToken, accountId } = this.loadAuth();
    this.accessToken = accessToken;
    this.accountId = accountId;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    try {
      const payloadB64 = token.split('.')[1];
      if (!payloadB64) throw new Error('Codex access token is not a valid JWT.');

      const padded = payloadB64.padEnd(payloadB64.length + (4 - (payloadB64.length % 4)) % 4, '=');
      const payloadJson = Buffer.from(padded, 'base64url').toString('utf-8');
      return JSON.parse(payloadJson) as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error('Unable to decode Codex access token payload: ' + msg);
    }
  }

  private extractAccountId(payload: Record<string, unknown>): string {
    const profile = payload['https://api.openai.com/profile'] as Record<string, unknown> | undefined;
    if (profile && profile.account_id) {
      return String(profile.account_id);
    }
    if (payload.account_id) return String(payload.account_id);
    if (payload.sub) return String(payload.sub);

    throw new Error("Unable to determine chatgpt-account-id from Codex token payload.");
  }

  private loadAuth() {
    if (!fs.existsSync(this.authPath)) {
      throw new Error(`ChatCodex requires Codex auth. Expected auth file at ${this.authPath}.`);
    }

    const auth = JSON.parse(fs.readFileSync(this.authPath, 'utf8')) as Record<string, unknown>;
    const accessToken = this.extractAccessToken(auth);
    if (!accessToken) {
      throw new Error(`Codex auth file does not contain an access token.`);
    }

    const payload = this.decodeJwtPayload(accessToken);
    const accountId = this.extractAccountId(payload);

    return { accessToken, accountId };
  }

  private extractAccessToken(auth: Record<string, unknown>): string | null {
    const tokens = auth.tokens as Record<string, unknown> | undefined;
    if (tokens && tokens.access_token) return String(tokens.access_token);
    if (auth.token) return String(auth.token);
    return null;
  }

  _llmType() {
    return "codex";
  }

  private convertMessages(messages: BaseMessage[]) {
    return messages.map((msg) => {
      let role = "user";
      let type = "input_text";
      if (msg._getType() === "ai") role = "assistant";
      if (msg._getType() === "system") role = "system";
      if (msg._getType() === "tool") role = "user";
      if (msg._getType() === "ai") type = "output_text";

      return {
        role,
        content: [
          {
            type,
            text: msg.content.toString(),
          },
        ],
      };
    });
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<ChatCodexCallOptions>
  ) {
    this.tools = tools;
    return this;
  }

  private convertTools(tools: BindToolsInput[]) {

    return tools.map((t: any) => {
      const name = t.name || t.function?.name;
      const description = t.description || t.function?.description;
      const parameters = z.toJSONSchema(t.schema) || { type: "object", properties: {}, required: [] };

      return {
        type: "function",
        name,
        description,
        parameters
      }
    });
  }

  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    let combinedChunk: ChatGenerationChunk | undefined;
    for await (const chunk of this._streamResponseChunks(messages, options, runManager)) {
      combinedChunk = combinedChunk ? combinedChunk.concat(chunk) : chunk;
    }

    const assistantMessage = (combinedChunk?.message as AIMessageChunk | undefined) ?? new AIMessageChunk({ content: "" });
    const fullContent = combinedChunk?.text ?? "";
    const toolCalls = assistantMessage.tool_calls ?? [];

    return {
      generations: [
        {
          text: fullContent,
          message: new AIMessage({
            content: fullContent,
            tool_calls: toolCalls
          }),
        },
      ],
    };
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const { randomUUID } = require('crypto');
    const headers = {
      "Authorization": `Bearer ${this.accessToken}`,
      "chatgpt-account-id": this.accountId,
      "OpenAI-Beta": "responses=experimental",
      "originator": "codex_cli_rs",
      "session_id": randomUUID(),
      "accept": "text/event-stream",
      "content-type": "application/json",
      "User-Agent": "typescript-codex-client/1.0",
    };

    const body: any = {
      model: this.modelName,
      stream: true,
      store: false,
      instructions: "You are a helpful assistant.",
      text: { verbosity: "medium" },
      input: this.convertMessages(messages),
    };

    let tools = this.tools;
    if (options.tools) {
      tools = this.tools.concat(options.tools);
    }

    body.tools = this.convertTools(tools)
    body.tool_choice = "auto";
    body.parallel_tool_calls = false;

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Codex API Error: ${response.status} - ${errorText} ${JSON.stringify(body)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    // Track tool calls being built
    const toolCalls: Record<string, { id: string, name: string, args: string, index: number }> = {};
    let toolCallCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          let content = "";
          let chunkToolCallChunks: ToolCallChunk[] = [];

          if (event.type === "response.output_text.delta") {
            content = event.delta ?? "";
          } else if (event.type === "response.output_item.added") {
            const item = event.item;
            if (item?.type === "function_call") {
              const index = toolCallCount++;
              toolCalls[item.id] = { id: item.id, name: item.name, args: "", index };
              chunkToolCallChunks.push({
                name: item.name,
                args: "",
                id: item.id,
                index
              });
            }
          } else if (event.type === "response.function_call_arguments.delta") {
            const call = toolCalls[event.item_id];
            if (call) {
              call.args += event.delta ?? "";
              chunkToolCallChunks.push({
                args: event.delta ?? "",
                id: event.item_id,
                index: call.index
              });
            }
          }

          if (content || chunkToolCallChunks.length > 0) {
            const chunk = new ChatGenerationChunk({
              message: new AIMessageChunk({
                content,
                tool_call_chunks: chunkToolCallChunks.length > 0 ? chunkToolCallChunks : undefined
              }),
              text: content,
            });
            yield chunk;
            if (content) {
              await runManager?.handleLLMNewToken(content);
            }
          }
        } catch (e) {
          // Ignore parse errors for non-JSON SSE lines
        }
      }
    }
  }
}

export function createCodexChatModel(config: Partial<CodexConfig> = {}) {
  return new ChatCodex(config);
}
