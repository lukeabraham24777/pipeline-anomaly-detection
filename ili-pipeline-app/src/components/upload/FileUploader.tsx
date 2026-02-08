import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseXlsxFile, getXlsxHeaders } from '@/lib/parsing/xlsxParser';
import { validateData } from '@/lib/parsing/validator';
import { normalizeAnomalies } from '@/lib/parsing/normalizer';
import { usePipelineStore } from '@/store/pipelineStore';
import { runPipeline } from '@/lib/pipeline';
import type { RunFile } from '@/types';
import { FilePreview } from './FilePreview';

const RUN_LABELS = ['Run 1 (Oldest)', 'Run 2 (Middle)', 'Run 3 (Most Recent)'];
const DEFAULT_YEARS = [2015, 2019, 2024];

export function FileUploader() {
  const [files, setFiles] = useState<(RunFile | null)[]>([null, null, null]);
  const [years, setYears] = useState<number[]>(DEFAULT_YEARS);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [parsing, setParsing] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const navigate = useNavigate();
  const { setRunFiles, setProcessing: setStoreProcessing } = usePipelineStore();

  const handleFileDrop = useCallback(
    async (fileList: FileList, slotIndex: number) => {
      const file = fileList[0];
      if (!file || !file.name.endsWith('.xlsx')) {
        alert('Please upload an .xlsx file');
        return;
      }

      setParsing(slotIndex);

      try {
        const [rawData, headers] = await Promise.all([
          parseXlsxFile(file),
          getXlsxHeaders(file),
        ]);

        const validation = validateData(rawData, headers);
        const normalizedData = normalizeAnomalies(rawData, slotIndex);

        const runFile: RunFile = {
          file,
          name: file.name,
          year: years[slotIndex],
          run_index: slotIndex,
          raw_data: rawData,
          normalized_data: normalizedData,
          row_count: rawData.length,
          validation,
        };

        setFiles((prev) => {
          const updated = [...prev];
          updated[slotIndex] = runFile;
          return updated;
        });
      } catch (error) {
        alert(`Error parsing file: ${error}`);
      } finally {
        setParsing(null);
      }
    },
    [years]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      setDragOver(null);
      if (e.dataTransfer.files.length > 0) {
        handleFileDrop(e.dataTransfer.files, index);
      }
    },
    [handleFileDrop]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileDrop(e.target.files, index);
      }
    },
    [handleFileDrop]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[index] = null;
      return updated;
    });
  };

  const allFilesLoaded = files.every((f) => f !== null);
  // We no longer block on validation – any loaded file is accepted.
  // The data cleaner will handle quality issues downstream.

  const handleAnalyze = async () => {
    if (!allFilesLoaded) return;

    setProcessing(true);
    setStoreProcessing({ status: 'parsing', progress: 0, message: 'Starting analysis...' });

    try {
      const validFiles = files.filter((f): f is RunFile => f !== null);
      setRunFiles(validFiles);

      await runPipeline(validFiles, years);

      navigate('/dashboard');
    } catch (error) {
      console.error('Pipeline error:', error);
      setStoreProcessing({
        status: 'error',
        message: `Error: ${error}`,
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Year Configuration */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Inspection Years</h3>
          <div className="grid grid-cols-3 gap-4">
            {RUN_LABELS.map((label, i) => (
              <div key={i}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="number"
                  value={years[i]}
                  onChange={(e) => {
                    const newYears = [...years];
                    newYears[i] = parseInt(e.target.value, 10);
                    setYears(newYears);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={1990}
                  max={2030}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* File Upload Slots */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {RUN_LABELS.map((label, index) => {
          const runFile = files[index];
          const isParsing = parsing === index;

          return (
            <Card
              key={index}
              className={`relative transition-all ${
                dragOver === index ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              } ${runFile ? (runFile.validation.warnings.length === 0 ? 'border-green-300' : 'border-yellow-300') : ''}`}
            >
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{label}</h3>

                {isParsing ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-sm text-gray-500">Parsing file...</p>
                  </div>
                ) : runFile ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <FileSpreadsheet className="h-5 w-5 text-green-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                            {runFile.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {runFile.row_count.toLocaleString()} anomalies
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Validation Status */}
                    <div
                      className={`rounded-md p-2 text-xs ${
                        runFile.validation.is_valid
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        {runFile.validation.is_valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                        )}
                        {runFile.validation.is_valid ? 'Valid' : 'Issues Found'}
                      </div>
                      {runFile.validation.errors.map((err, i) => (
                        <p key={i} className="ml-4">{err}</p>
                      ))}
                      {runFile.validation.warnings.map((warn, i) => (
                        <p key={i} className="ml-4 text-yellow-700">{warn}</p>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
                    >
                      {previewIndex === index ? 'Hide Preview' : 'Preview Data'}
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(index);
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => handleDrop(e, index)}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      Drag & drop XLSX file
                    </p>
                    <p className="text-xs text-gray-400 mb-3">or</p>
                    <label className="cursor-pointer">
                      <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Browse files
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => handleFileInput(e, index)}
                      />
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview */}
      {previewIndex !== null && files[previewIndex] && (
        <FilePreview runFile={files[previewIndex]!} />
      )}

      {/* Analyze Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!allFilesLoaded || processing}
          onClick={handleAnalyze}
          className="min-w-[200px]"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Analyze Pipeline Data'
          )}
        </Button>
      </div>
    </div>
  );
}
