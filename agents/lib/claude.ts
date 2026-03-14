import { createAnthropic } from "@ai-sdk/anthropic";

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const opusModel = anthropic("claude-opus-4-5");
export const sonnetModel = anthropic("claude-sonnet-4-5");
