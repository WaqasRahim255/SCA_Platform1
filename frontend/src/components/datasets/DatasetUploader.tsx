import { useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CleaningSuggestions } from "@/components/datasets/CleaningSuggestions";
import { DatasetPreview } from "@/components/datasets/DatasetPreview";
import { StudyContextForm } from "@/components/datasets/StudyContextForm";
import {
  analyseDatasetCleaning,
  getDatasetMetadata,
  getDatasetPreview,
  uploadDataset,
} from "@/services/api";
import type {
  DatasetCleaningAnalysisResponse,
  DatasetMetadataResponse,
  DatasetPreviewResponse,
  DatasetUploadResponse,
} from "@/types/api";
import { cn } from "@/utils/cn";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".sav"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function DatasetUploader() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatasetUploadResponse | null>(null);
  const [metadata, setMetadata] = useState<DatasetMetadataResponse | null>(null);
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [cleaningAnalysis, setCleaningAnalysis] = useState<DatasetCleaningAnalysisResponse | null>(
    null,
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCleaningLoading, setIsCleaningLoading] = useState(false);

  function validateFile(candidate: File) {
    const extension = getExtension(candidate.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return "Unsupported file type. Use CSV, Excel, or SPSS.";
    }

    if (candidate.size > MAX_FILE_SIZE) {
      return "File is larger than the 50MB upload limit.";
    }

    return null;
  }

  function selectFile(candidate: File | null) {
    if (!candidate) return;

    const validationError = validateFile(candidate);
    setResult(null);
    setMetadata(null);
    setPreview(null);
    setCleaningAnalysis(null);
    setProgress(0);

    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }

    setFile(candidate);
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResult(null);
    setMetadata(null);
    setPreview(null);
    setCleaningAnalysis(null);
    setProgress(0);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("You must be signed in to upload datasets.");
      }

      const response = await uploadDataset(file, token, setProgress);
      setResult(response);
      localStorage.setItem("sca:lastDatasetId", response.id);
      setProgress(100);
      const metadataResponse = await getDatasetMetadata(response.id, token);
      setMetadata(metadataResponse);
      setIsPreviewLoading(true);
      const previewResponse = await getDatasetPreview(response.id, token);
      setPreview(previewResponse);
      setIsCleaningLoading(true);
      const cleaningResponse = await analyseDatasetCleaning(response.id, token);
      setCleaningAnalysis(cleaningResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      setIsPreviewLoading(false);
      setIsCleaningLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div
          className={cn(
            "rounded-lg border border-dashed border-border bg-card p-6 transition-colors",
            isDragging && "border-primary bg-primary/10",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            selectFile(event.dataTransfer.files.item(0));
          }}
        >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls,.sav"
          onChange={(event) => selectFile(event.target.files?.item(0) ?? null)}
        />

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Upload dataset</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Drag a CSV, Excel, or SPSS file here, or choose one from your computer.
            </p>
          </div>
          <Button variant="outline" onClick={() => inputRef.current?.click()} type="button">
            Select File
          </Button>
        </div>

        {file && (
          <div className="mt-6 rounded-lg border border-border bg-background/50 p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-1 h-5 w-5 flex-none text-accent" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {getExtension(file.name).replace(".", "").toUpperCase()} • {formatBytes(file.size)}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{progress}% uploaded</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={handleUpload} disabled={!file || isUploading} type="button">
            {isUploading ? "Uploading..." : "Upload Dataset"}
          </Button>
          <p className="text-xs text-muted-foreground">Maximum size: 50MB</p>
        </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Upload status</h2>
          {!error && !result && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Select a dataset to see validation, progress, and parsing results.
            </p>
          )}

          {error && (
            <div className="mt-4 flex gap-3 text-sm text-destructive">
              <XCircle className="h-5 w-5 flex-none" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-4">
              <div className="flex gap-3 text-sm text-primary">
                <CheckCircle2 className="h-5 w-5 flex-none" aria-hidden="true" />
                <p>{result.message}</p>
              </div>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">File</dt>
                  <dd className="mt-1 break-words font-medium">{result.file_name}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="mt-1 font-medium">{result.file_type}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Size</dt>
                    <dd className="mt-1 font-medium">{formatBytes(result.file_size)}</dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-muted-foreground">Rows sampled</dt>
                    <dd className="mt-1 font-medium">{result.rows ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Columns</dt>
                    <dd className="mt-1 font-medium">{result.columns ?? "Unknown"}</dd>
                  </div>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dataset ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs">{result.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">SHA256</dt>
                  <dd className="mt-1 break-all font-mono text-xs">{result.sha256}</dd>
                </div>
              </dl>
            </div>
          )}

          {metadata && (
            <p className="mt-4 text-xs text-muted-foreground">
              Metadata endpoint confirmed {metadata.rows ?? "unknown"} rows and{" "}
              {metadata.columns ?? "unknown"} columns.
            </p>
          )}

          {isPreviewLoading && (
            <p className="mt-4 text-sm text-muted-foreground">Preparing dataset preview...</p>
          )}
          {isCleaningLoading && (
            <p className="mt-2 text-sm text-muted-foreground">Analysing cleaning suggestions...</p>
          )}
        </div>
      </div>

      {cleaningAnalysis && <CleaningSuggestions analysis={cleaningAnalysis} />}
      {result && <StudyContextForm datasetId={result.id} datasetName={result.file_name} />}
      {preview && <DatasetPreview preview={preview} />}
    </div>
  );
}
