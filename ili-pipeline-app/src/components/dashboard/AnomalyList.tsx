import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { usePipelineStore } from '@/store/pipelineStore';
import { useUIStore } from '@/store/uiStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PRIORITY_CONFIG } from '@/types';
import type { AnomalyMatch, PriorityLevel } from '@/types';
import { priorityToScore } from '@/lib/analysis/priority';
import { ArrowUpDown, Filter } from 'lucide-react';

const priorityVariantMap: Record<string, 'immediate' | 'sixtyDay' | 'oneEightyDay' | 'scheduled' | 'monitor'> = {
  'IMMEDIATE': 'immediate',
  '60-DAY': 'sixtyDay',
  '180-DAY': 'oneEightyDay',
  'SCHEDULED': 'scheduled',
  'MONITOR': 'monitor',
};

export function AnomalyList() {
  const { matches } = usePipelineStore();
  const { setSelectedMatchId, setProfileOpen, priorityFilter, togglePriorityFilter } = useUIStore();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority_score', desc: true },
  ]);

  // Enrich matches with sort score
  const data = useMemo(() => {
    // Pipeline already filters out reference points, but guard here too
    let filtered = matches.filter((m) => {
      if (m.match_status === 'missing') return false;
      const latest = m.anomalies[m.anomalies.length - 1];
      if (!latest) return false;
      if (latest.is_reference_point) return false;
      return true;
    });

    if (priorityFilter.length > 0) {
      filtered = filtered.filter((m) => priorityFilter.includes(m.priority));
    }

    return filtered.map((m) => ({
      ...m,
      priority_score: priorityToScore(m.priority),
      latest_feature_id: m.anomalies[m.anomalies.length - 1]?.feature_id || 'Unknown',
      latest_depth: m.anomalies[m.anomalies.length - 1]?.depth_percent || 0,
      latest_distance: m.anomalies[m.anomalies.length - 1]?.corrected_distance || 0,
      latest_type: m.anomalies[m.anomalies.length - 1]?.canonical_type || 'unknown',
    }));
  }, [matches, priorityFilter]);

  const columns = useMemo<ColumnDef<typeof data[0]>[]>(
    () => [
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => {
          const level = row.original.priority as PriorityLevel;
          return (
            <Badge variant={priorityVariantMap[level]}>
              {PRIORITY_CONFIG[level].label}
            </Badge>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'latest_feature_id',
        header: 'Feature ID',
        size: 120,
      },
      {
        accessorKey: 'latest_distance',
        header: 'Distance (ft)',
        cell: ({ getValue }) => (getValue() as number).toFixed(0),
        size: 100,
      },
      {
        accessorKey: 'latest_depth',
        header: 'Depth (%)',
        cell: ({ row }) => {
          const depth = row.original.latest_depth;
          return (
            <span className={depth >= 60 ? 'text-red-600 font-semibold' : depth >= 40 ? 'text-orange-600' : ''}>
              {depth.toFixed(1)}%
            </span>
          );
        },
        size: 80,
      },
      {
        accessorKey: 'depth_growth_rate',
        header: 'Growth (%/yr)',
        cell: ({ getValue }) => {
          const rate = getValue() as number;
          return (
            <span className={rate > 3 ? 'text-red-600 font-semibold' : rate > 1 ? 'text-orange-600' : ''}>
              {rate.toFixed(2)}
            </span>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'time_to_critical',
        header: 'Time to Critical',
        cell: ({ getValue }) => {
          const ttc = getValue() as number | null;
          if (ttc === null) return <span className="text-gray-400">N/A</span>;
          return (
            <span className={ttc < 5 ? 'text-red-600 font-semibold' : ''}>
              {ttc.toFixed(1)} yr
            </span>
          );
        },
        size: 110,
      },
      {
        accessorKey: 'confidence',
        header: 'Confidence',
        cell: ({ getValue }) => {
          const conf = getValue() as number;
          return (
            <div className="flex items-center gap-2">
              <div className="w-16 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    conf >= 0.7 ? 'bg-green-500' : conf >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${conf * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{(conf * 100).toFixed(0)}%</span>
            </div>
          );
        },
        size: 130,
      },
      {
        accessorKey: 'match_status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const colors: Record<string, string> = {
            matched: 'bg-green-100 text-green-800',
            uncertain: 'bg-yellow-100 text-yellow-800',
            new: 'bg-blue-100 text-blue-800',
            missing: 'bg-gray-100 text-gray-800',
          };
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || ''}`}>
              {status}
            </span>
          );
        },
        size: 90,
      },
      {
        accessorKey: 'priority_score',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1"
          >
            Sort <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        size: 60,
        cell: () => null,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Anomaly List
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({data.length} anomalies)
            </span>
          </CardTitle>

          {/* Priority filter buttons */}
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-gray-400 mr-1" />
            {(['IMMEDIATE', '60-DAY', '180-DAY', 'SCHEDULED', 'MONITOR'] as const).map(
              (level) => (
                <button
                  key={level}
                  onClick={() => togglePriorityFilter(level)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    priorityFilter.length === 0 || priorityFilter.includes(level)
                      ? `${PRIORITY_CONFIG[level].bgColor} ${PRIORITY_CONFIG[level].textColor}`
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {PRIORITY_CONFIG[level].label}
                </button>
              )
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-gray-200">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedMatchId(row.original.id);
                    setProfileOpen(true);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 text-sm text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No anomalies match the current filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
