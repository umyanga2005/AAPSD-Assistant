export interface ModelProvider {
  generate(prompt: string): Promise<unknown>;
}
