import "dotenv/config";
import { chat } from "../ai/provider.js";

const expectedProvider = process.env.AI_SMOKE_EXPECT_PROVIDER?.trim();
const result = await chat(
  [{ role: "user", content: "Return exactly one lowercase word: ok" }],
  { temperature: 0, maxTokens: 128 },
);

if (expectedProvider && result.provider !== expectedProvider) {
  throw new Error(`Expected provider ${expectedProvider}, received ${result.provider}`);
}

console.log(JSON.stringify({
  ok: result.text.length > 0 || result.toolCalls.length > 0,
  provider: result.provider,
  model: result.model,
  latencyMs: result.latencyMs,
}));
