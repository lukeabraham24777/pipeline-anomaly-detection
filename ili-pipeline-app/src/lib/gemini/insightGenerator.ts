import type { AnomalyMatch, OdometerDriftPoint, PipelineInsights } from '@/types';
import { generateContent, isGeminiAvailable } from './client';

/**
 * Generate a comprehensive pipeline health summary using Gemini AI.
 */
export async function generatePipelineInsights(
  matches: AnomalyMatch[],
  odometerDrift: OdometerDriftPoint[],
  years: number[]
): Promise<PipelineInsights | null> {
  if (!isGeminiAvailable()) return null;

  // Build summary statistics for the prompt
  const totalMatches = matches.length;
  const matched = matches.filter((m) => m.match_status === 'matched').length;
  const uncertain = matches.filter((m) => m.match_status === 'uncertain').length;
  const newAnomalies = matches.filter((m) => m.match_status === 'new').length;
  const missing = matches.filter((m) => m.match_status === 'missing').length;

  const immediate = matches.filter((m) => m.priority === 'IMMEDIATE').length;
  const sixtyDay = matches.filter((m) => m.priority === '60-DAY').length;
  const oneEightyDay = matches.filter((m) => m.priority === '180-DAY').length;

  const avgGrowth = matches
    .filter((m) => m.depth_growth_rate > 0)
    .reduce((sum, m) => sum + m.depth_growth_rate, 0) /
    (matches.filter((m) => m.depth_growth_rate > 0).length || 1);

  const fastGrowing = matches
    .filter((m) => m.depth_growth_rate > 3)
    .map((m) => ({
      id: m.anomalies[m.anomalies.length - 1]?.feature_id,
      rate: m.depth_growth_rate,
      depth: m.anomalies[m.anomalies.length - 1]?.depth_percent,
      distance: m.anomalies[m.anomalies.length - 1]?.corrected_distance,
    }));

  const maxDrift = odometerDrift.length > 0
    ? Math.max(...odometerDrift.map((d) => Math.abs(d.drift)))
    : 0;

  const prompt = `You are a pipeline integrity management expert reviewing ILI (In-Line Inspection) data alignment results. Generate a concise pipeline health assessment.

Data Summary:
- Inspection years: ${years.join(', ')}
- Total anomalies analyzed: ${totalMatches}
- Successfully matched: ${matched} (${((matched / totalMatches) * 100).toFixed(1)}%)
- Uncertain matches needing review: ${uncertain}
- New anomalies (not in prior runs): ${newAnomalies}
- Missing anomalies (not found in latest run): ${missing}

Priority Distribution (per PHMSA 49 CFR 192/195):
- IMMEDIATE: ${immediate}
- 60-DAY: ${sixtyDay}
- 180-DAY: ${oneEightyDay}

Growth Statistics:
- Average depth growth rate: ${avgGrowth.toFixed(2)}%/yr
- Anomalies growing >3%/yr: ${fastGrowing.length}
${fastGrowing.slice(0, 5).map((a) => `  - ${a.id}: ${a.rate.toFixed(2)}%/yr at ${a.depth?.toFixed(1)}% depth, ${a.distance?.toFixed(0)}ft`).join('\n')}

Odometer Performance:
- Maximum drift: ${maxDrift.toFixed(1)} ft
${maxDrift > 50 ? '- ALERT: Significant odometer drift detected' : '- Drift within acceptable range'}

Respond in this exact JSON format:
{
  "summary": "2-3 sentence executive summary of pipeline health",
  "key_risks": ["risk 1", "risk 2", "risk 3"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "odometer_assessment": "1-2 sentence assessment of odometer performance and calibration needs"
}`;

  try {
    const response = await generateContent(prompt);
    const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary,
      key_risks: parsed.key_risks,
      recommendations: parsed.recommendations,
      odometer_assessment: parsed.odometer_assessment,
    };
  } catch (error) {
    console.error('Failed to generate pipeline insights:', error);
    return null;
  }
}
