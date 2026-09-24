/**
 * LLM list prices in USD per 1M tokens. Only tokens are stored in the event log; cost is always
 * computed from this table when reading, so correcting a price here fixes all historic numbers.
 *
 * NOT YET VERIFIED — these are DeepSeek's published prices as remembered (V3.2 pricing, late
 * 2025). Check https://api-docs.deepseek.com/quick_start/pricing and set PRICING_VERIFIED_ON
 * (ISO date) before any cost figure goes into a report. The evaluation page warns while null.
 */
export const PRICING_VERIFIED_ON: string | null = null;

type ModelPrice = { inputCacheHit: number; inputCacheMiss: number; output: number };

const PRICES_USD_PER_MTOK: Record<string, ModelPrice> = {
  "deepseek-chat": { inputCacheHit: 0.028, inputCacheMiss: 0.28, output: 0.42 },
  "deepseek-reasoner": { inputCacheHit: 0.028, inputCacheMiss: 0.28, output: 0.42 },
};

/** Cost of one call in USD, or null when the model has no known price (e.g. a local model). */
export function llmCostUsd(input: {
  model: string;
  promptTokens: number;
  cacheHitTokens: number;
  completionTokens: number;
}): number | null {
  const price = PRICES_USD_PER_MTOK[input.model];
  if (!price) return null;
  const cacheMiss = Math.max(0, input.promptTokens - input.cacheHitTokens);
  return (
    (input.cacheHitTokens * price.inputCacheHit +
      cacheMiss * price.inputCacheMiss +
      input.completionTokens * price.output) /
    1_000_000
  );
}
