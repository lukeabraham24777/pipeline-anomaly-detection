import { usePipelineStore } from '@/store/pipelineStore';
import { useNavigate } from 'react-router-dom';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { PipelineMap } from '@/components/map/PipelineMap';
import { AnomalyList } from '@/components/dashboard/AnomalyList';
import { AnomalyProfile } from '@/components/dashboard/AnomalyProfile';
import { OdometerDriftChart } from '@/components/dashboard/OdometerDriftChart';
import { GrowthTrendChart } from '@/components/charts/GrowthTrendChart';
import { GeminiInsightsPanel } from '@/components/ai/GeminiInsightsPanel';
import { CleaningReportCard } from '@/components/dashboard/CleaningReportCard';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export function DashboardPage() {
  const { matches, runFiles } = usePipelineStore();
  const { selectedMatchId, profileOpen } = useUIStore();
  const navigate = useNavigate();

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center">
          <Upload className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            No Data Loaded
          </h2>
          <p className="text-gray-500 mb-6">
            Upload inspection files first to view the dashboard.
          </p>
          <Button onClick={() => navigate('/')}>
            Go to Upload
          </Button>
        </div>
      </div>
    );
  }

  const selectedMatch = selectedMatchId
    ? matches.find((m) => m.id === selectedMatchId)
    : null;

  return (
    <div className="flex h-full">
      <div className={`flex-1 overflow-auto ${profileOpen ? 'mr-96' : ''}`}>
        <div className="p-6 space-y-6">
          {/* Metrics */}
          <MetricsCards />

          {/* Data Cleaning Report */}
          <CleaningReportCard />

          {/* Gemini Insights */}
          <GeminiInsightsPanel />

          {/* Map View */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Pipeline Map</h2>
              <p className="text-sm text-gray-500">
                Click on a marker to view anomaly details
              </p>
            </div>
            <PipelineMap />
          </div>

          {/* Odometer Drift Chart */}
          <OdometerDriftChart />

          {/* Growth Trend Chart */}
          {selectedMatch && <GrowthTrendChart match={selectedMatch} runFiles={runFiles} />}

          {/* Anomaly List */}
          <AnomalyList />
        </div>
      </div>

      {/* Profile Slide-out */}
      {profileOpen && selectedMatch && (
        <AnomalyProfile match={selectedMatch} />
      )}
    </div>
  );
}
