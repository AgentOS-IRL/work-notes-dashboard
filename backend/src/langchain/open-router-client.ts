import OpenAI from 'openai';
import type { ChatTurn } from './conversation';

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required to generate chat session names.');
  }

  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_APP_TITLE ?? 'work-notes-dashboard'
    }
  });
}

function formatMessages(messages: ChatTurn[]) {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n');
}

function sanitizeSessionName(content: string) {
  return content
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/g, '')
    .trim();
}

export async function generateSessionNameFromOpenRouter(messages: ChatTurn[]) {
  const client = createOpenRouterClient();
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You name chat sessions. Return a concise title of 2 to 5 words in Title Case. Do not use quotes, punctuation, or markdown.'
      },
      {
        role: 'user',
        content: `Name this chat session from the recent user turns:\n\n${formatMessages(messages)}`
      }
    ]
  });

  const rawContent = response.choices[0]?.message?.content;
  if (typeof rawContent !== 'string' || rawContent.trim() === '') {
    throw new Error('No session name was returned from OpenRouter.');
  }

  return sanitizeSessionName(rawContent);
}
