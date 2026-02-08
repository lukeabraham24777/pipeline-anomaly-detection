import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunFile } from '@/types';

interface FilePreviewProps {
  runFile: RunFile;
}

const PREVIEW_COLUMNS = [
  'feature_id',
  'distance',
  'odometer',
  'clock_position',
  'feature_type',
  'depth_percent',
  'length',
  'width',
  'wall_thickness',
];

export function FilePreview({ runFile }: FilePreviewProps) {
  const previewRows = runFile.raw_data.slice(0, 10);

  // Get all available column keys from the data
  const availableColumns = PREVIEW_COLUMNS.filter((col) =>
    previewRows.some((row) => {
      const rowRecord = row as unknown as Record<string, unknown>;
      return rowRecord[col] !== undefined && rowRecord[col] !== null;
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Preview: {runFile.name}
          <span className="text-sm font-normal text-gray-500 ml-2">
            (showing first {previewRows.length} of {runFile.row_count} rows)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {availableColumns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {previewRows.map((row, i) => {
                const rowRecord = row as unknown as Record<string, unknown>;
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    {availableColumns.map((col) => (
                      <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {formatValue(rowRecord[col])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function formatValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}
