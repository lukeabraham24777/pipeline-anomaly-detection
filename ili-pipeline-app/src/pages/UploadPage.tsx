import { FileUploader } from '@/components/upload/FileUploader';

export function UploadPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Upload Inspection Data
        </h1>
        <p className="text-gray-600 mb-8">
          Upload 3 ILI inspection XLSX files from different years. The system will
          align odometer readings, match anomalies across runs, and calculate growth
          rates.
        </p>
        <FileUploader />
      </div>
    </div>
  );
}
