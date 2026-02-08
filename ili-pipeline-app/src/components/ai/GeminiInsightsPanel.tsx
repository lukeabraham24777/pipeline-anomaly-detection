import { useState, useCallback } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isGeminiAvailable } from '@/lib/gemini/client';
import { generatePipelineInsights } from '@/lib/gemini/insightGenerator';
import { analyzeUncertainMatches } from '@/lib/gemini/mismatchAnalysis';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Lightbulb,
  Gauge,
} from 'lucide-react';

export function GeminiInsightsPanel() {
  const { insights, setInsights, matches, odometerDrift, runFiles, setMatches } = usePipelineStore();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [analyzingMatches, setAnalyzingMatches] = useState(false);

  const years = runFiles.map((f) => f.year).sort();

  const handleGenerateInsights = useCallback(async () => {
    setLoading(true);
    try {
      const result = await generatePipelineInsights(matches, odometerDrift, years);
      if (result) {
        setInsights(result);
      }
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setLoading(false);
    }
  }, [matches, odometerDrift, years, setInsights]);

  const handleAnalyzeMatches = useCallback(async () => {
    setAnalyzingMatches(true);
    try {
      const assessments = await analyzeUncertainMatches(matches);

      // Update matches with Gemini assessments
      const updatedMatches = matches.map((m) => {
        const assessment = assessments.get(m.id);
        if (assessment) {
          return {
            ...m,
            gemini_assessment: assessment,
            confidence: assessment.adjusted_confidence,
            match_status: assessment.recommendation === 'no_match' ? 'new' as const : m.match_status,
          };
        }
        return m;
      });

      setMatches(updatedMatches);
    } catch (error) {
      console.error('Failed to analyze matches:', error);
    } finally {
      setAnalyzingMatches(false);
    }
  }, [matches, setMatches]);

  const uncertainCount = matches.filter((m) => m.match_status === 'uncertain').length;

  if (!isGeminiAvailable()) {
    return (
      <Card className="border-dashed border-purple-300 bg-purple-50/50">
        <CardContent className="py-4 px-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-sm font-medium text-purple-700">
                AI Insights Available
              </p>
              <p className="text-xs text-purple-500">
                Add your Gemini API key to <code className="bg-purple-100 px-1 rounded">.env</code> as{' '}
                <code className="bg-purple-100 px-1 rounded">VITE_GEMINI_API_KEY</code> to enable
                AI-powered mismatch analysis and pipeline health insights.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Pipeline Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            {uncertainCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyzeMatches}
                disabled={analyzingMatches}
              >
                {analyzingMatches ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyzing...</>
                ) : (
                  <>Review {uncertainCount} Uncertain Matches</>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateInsights}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
              ) : insights ? (
                'Refresh Insights'
              ) : (
                'Generate Insights'
              )}
            </Button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-gray-100"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && insights && (
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-900">{insights.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Key Risks */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                Key Risks
              </h4>
              <ul className="space-y-1">
                {insights.key_risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                Recommendations
              </h4>
              <ul className="space-y-1">
                {insights.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Odometer Assessment */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5 text-orange-500" />
                Odometer Assessment
              </h4>
              <p className="text-xs text-gray-700">{insights.odometer_assessment}</p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
