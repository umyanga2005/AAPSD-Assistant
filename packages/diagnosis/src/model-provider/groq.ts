import type { ModelProvider } from './types.js';

let globalTokenUsage = 0;
const MAX_TOKEN_BUDGET = 500000; // 500k tokens max

export class GroqModelProvider implements ModelProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey ?? process.env.GROQ_API_KEY ?? '';
    this.model = options?.model ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    this.timeoutMs = options?.timeoutMs ?? 60_000;

    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required for the Groq provider');
    }
  }

  async generate(prompt: string): Promise<unknown> {
    if (globalTokenUsage >= MAX_TOKEN_BUDGET) {
      throw new Error('LLM Budget Exceeded: The maximum token allowance has been reached.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`Groq API error: ${response.status} — ${errorBody}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };

      const content = data?.choices?.[0]?.message?.content;
      const tokensUsed = data?.usage?.total_tokens || 0;
      globalTokenUsage += tokensUsed;

      if (!content) {
        throw new Error('Groq response missing content in choice message');
      }

      // Sometimes models wrap JSON in markdown even with response_format constraints
      let jsonString = content.trim();
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.slice(7);
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.slice(3);
      }
      if (jsonString.endsWith('```')) {
        jsonString = jsonString.slice(0, -3);
      }
      return JSON.parse(jsonString.trim());
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Groq request timed out');
      }
      if (err instanceof Error) throw err;
      throw new Error(`Groq unexpected error: ${String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
