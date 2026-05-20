import { Database } from "lucide-react";
import { DatasetUploader } from "@/components/datasets/DatasetUploader";

export function DatasetsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Data library</p>
        <h1 className="mt-1 text-2xl font-semibold">Datasets</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Upload CSV, Excel, or SPSS files and validate them before analysis.
        </p>
      </div>

      <DatasetUploader />

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <Database className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">Local storage enabled</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Uploaded files are saved locally by the API for now. This storage boundary can
              move to Azure or MinIO later without changing the dashboard workflow.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
