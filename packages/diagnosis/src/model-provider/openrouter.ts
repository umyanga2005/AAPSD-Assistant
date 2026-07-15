import type { ModelProvider } from './types.js';

export class OpenRouterModelProvider implements ModelProvider {
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
      };
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Groq response missing content in choice message');
      }

      let jsonString = content.trim();
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.slice(7);
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.slice(3);
      }
      if (jsonString.endsWith('```')) {
        jsonString = jsonString.slice(0, -3);
      }
      return JSON.parse(jsonString.trim()) as unknown;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Groq request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
