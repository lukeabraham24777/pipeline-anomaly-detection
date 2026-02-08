import { usePipelineStore } from '@/store/pipelineStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, ArrowRightLeft, Trash2, Ruler, TrendingDown, Activity } from 'lucide-react';

export function CleaningReportCard() {
  const { cleaningReports } = usePipelineStore();

  if (cleaningReports.length === 0) return null;

  // Aggregate stats
  const totalDuplicates = cleaningReports.reduce((s, r) => s + r.duplicates_removed, 0);
  const totalOutliers = cleaningReports.reduce((s, r) => s + r.outliers_clamped, 0);
  const totalInterpolated = cleaningReports.reduce((s, r) => s + r.missing_values_interpolated, 0);
  const totalMonoIssues = cleaningReports.reduce((s, r) => s + r.distance_monotonicity_issues, 0);
  const totalConversions = cleaningReports.reduce((s, r) => s + r.units_converted.length, 0);
  const totalActions = totalDuplicates + totalOutliers + totalInterpolated + totalMonoIssues + totalConversions;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Data Cleaning Summary</h2>
            <p className="text-sm text-gray-500">
              Automated cleaning applied before analysis
            </p>
          </div>
          <Badge variant={totalActions > 0 ? 'secondary' : 'default'}>
            {totalActions > 0 ? `${totalActions} actions taken` : 'Data clean'}
          </Badge>
        </div>

        {/* Aggregate metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <StatBox
            icon={<Trash2 className="h-4 w-4 text-red-500" />}
            label="Duplicates"
            value={totalDuplicates}
          />
          <StatBox
            icon={<ArrowRightLeft className="h-4 w-4 text-blue-500" />}
            label="Unit Conversions"
            value={totalConversions}
          />
          <StatBox
            icon={<TrendingDown className="h-4 w-4 text-orange-500" />}
            label="Outliers Clamped"
            value={totalOutliers}
          />
          <StatBox
            icon={<Activity className="h-4 w-4 text-purple-500" />}
            label="Interpolated"
            value={totalInterpolated}
          />
          <StatBox
            icon={<Ruler className="h-4 w-4 text-yellow-600" />}
            label="Monotonicity Issues"
            value={totalMonoIssues}
          />
        </div>

        {/* Per-run details */}
        <div className="space-y-3">
          {cleaningReports.map((report) => (
            <div
              key={report.run_index}
              className="border border-gray-100 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Run {report.run_index + 1} ({report.run_year})
                </h3>
                <span className="text-xs text-gray-500">
                  {report.original_row_count} rows → {report.final_row_count} rows
                </span>
              </div>

              <div className="space-y-1">
                {report.passes.map((pass, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {pass.rows_affected > 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <span className="font-medium text-gray-700">{pass.name}:</span>{' '}
                      <span className="text-gray-500">{pass.details[0]}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Unit conversion badges */}
              {report.units_converted.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {report.units_converted.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {c.field}: {c.from_unit} → {c.to_unit}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-100 p-2">
      {icon}
      <div>
        <div className="text-lg font-semibold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
