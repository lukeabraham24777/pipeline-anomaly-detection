import type { AnomalyMatch, GeminiAssessment } from '@/types';
import { generateContent, isGeminiAvailable } from './client';

/**
 * Analyze uncertain matches using Gemini AI.
 * Sends anomaly pair data and asks for a match recommendation.
 */
export async function analyzeUncertainMatch(
  match: AnomalyMatch
): Promise<GeminiAssessment | null> {
  if (!isGeminiAvailable()) return null;
  if (match.anomalies.length < 2) return null;

  const a1 = match.anomalies[0];
  const a2 = match.anomalies[match.anomalies.length - 1];

  const prompt = `You are a pipeline integrity engineer reviewing an ILI (In-Line Inspection) data alignment result. Two anomalies from different inspection runs have been tentatively matched with a confidence score of ${(match.confidence * 100).toFixed(0)}%.

Anomaly from Run 1:
- Feature ID: ${a1.feature_id}
- Distance: ${a1.corrected_distance.toFixed(1)} ft
- Depth: ${a1.depth_percent.toFixed(1)}%
- Length: ${a1.length.toFixed(2)} in
- Width: ${a1.width.toFixed(2)} in
- Clock Position: ${a1.clock_display}
- Feature Type: ${a1.feature_type}
- Wall Thickness: ${a1.wall_thickness.toFixed(3)} in

Anomaly from Run 2:
- Feature ID: ${a2.feature_id}
- Distance: ${a2.corrected_distance.toFixed(1)} ft
- Depth: ${a2.depth_percent.toFixed(1)}%
- Length: ${a2.length.toFixed(2)} in
- Width: ${a2.width.toFixed(2)} in
- Clock Position: ${a2.clock_display}
- Feature Type: ${a2.feature_type}
- Wall Thickness: ${a2.wall_thickness.toFixed(3)} in

Similarity breakdown:
- Distance similarity: ${(match.similarity_breakdown.distance * 100).toFixed(0)}%
- Dimensional similarity: ${(match.similarity_breakdown.dimensional * 100).toFixed(0)}%
- Clock position similarity: ${(match.similarity_breakdown.clock * 100).toFixed(0)}%
- Feature type similarity: ${(match.similarity_breakdown.feature_type * 100).toFixed(0)}%

Are these likely the same physical anomaly? Consider:
1. Distance offset after alignment correction
2. Whether dimensional changes are physically plausible (corrosion growth)
3. Clock position consistency
4. Feature type compatibility

Respond in this exact JSON format:
{
  "recommendation": "match" | "no_match" | "uncertain",
  "adjusted_confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation in 1-2 sentences"
}`;

  try {
    const response = await generateContent(prompt);
    // Parse JSON from response (may be wrapped in markdown code blocks)
    const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      recommendation: parsed.recommendation,
      adjusted_confidence: parsed.adjusted_confidence,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('Gemini analysis failed:', error);
    return null;
  }
}

/**
 * Batch analyze all uncertain matches.
 */
export async function analyzeUncertainMatches(
  matches: AnomalyMatch[]
): Promise<Map<string, GeminiAssessment>> {
  const uncertainMatches = matches.filter((m) => m.match_status === 'uncertain');
  const results = new Map<string, GeminiAssessment>();

  // Process in batches of 3 to avoid rate limiting
  const batchSize = 3;
  for (let i = 0; i < uncertainMatches.length; i += batchSize) {
    const batch = uncertainMatches.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((m) => analyzeUncertainMatch(m))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled' && result.value) {
        results.set(batch[j].id, result.value);
      }
    }

    // Small delay between batches
    if (i + batchSize < uncertainMatches.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}
