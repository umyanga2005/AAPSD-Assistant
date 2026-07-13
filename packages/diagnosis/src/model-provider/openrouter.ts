import type { ModelProvider } from './types.js';

export class OpenRouterModelProvider implements ModelProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
    this.model = options?.model ?? process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';
    this.timeoutMs = options?.timeoutMs ?? 60_000;

    if (!this.apiKey) {
      throw new Error(
        'OPENROUTER_API_KEY environment variable is required for the OpenRouter provider',
      );
    }
  }

  async generate(prompt: string): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        throw new Error(`OpenRouter API error: ${response.status} — ${errorBody}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('OpenRouter response missing content in choice message');
      }

      return JSON.parse(content) as unknown;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('OpenRouter request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
