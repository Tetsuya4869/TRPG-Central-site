import Anthropic from "@anthropic-ai/sdk";

export const GM_MODEL = "claude-sonnet-5";

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function createClient(): Anthropic {
  return new Anthropic();
}
