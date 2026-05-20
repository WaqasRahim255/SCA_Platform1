import { CheckCircle2, ShieldCheck, ShieldX } from "lucide-react";
import type { DatasetPreviewResponse } from "@/types/api";

interface DatasetPreviewProps {
  preview: DatasetPreviewResponse;
}

function formatCell(value: string | number | boolean | null) {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function DatasetPreview({ preview }: DatasetPreviewProps) {
  const sampleColumns = preview.columns.map((column) => column.name);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Rows</p>
          <p className="mt-1 text-2xl font-semibold">{preview.row_count.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Columns</p>
          <p className="mt-1 text-2xl font-semibold">{preview.column_count.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            {preview.integrity_verified ? (
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <ShieldX className="h-4 w-4 text-destructive" aria-hidden="true" />
            )}
            <p className="text-sm text-muted-foreground">Integrity</p>
          </div>
          <p className="mt-1 text-lg font-semibold">
            {preview.integrity_verified ? "Verified" : "Changed"}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-5">
          <h2 className="text-lg font-semibold">Dataset schema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Column names, inferred data types, and missing-value percentage.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Column</th>
                <th className="px-5 py-3 font-medium">Data type</th>
                <th className="px-5 py-3 font-medium">Null %</th>
              </tr>
            </thead>
            <tbody>
              {preview.columns.map((column) => (
                <tr key={column.name} className="border-b border-border/70 last:border-0">
                  <td className="px-5 py-3 font-medium">{column.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{column.data_type}</td>
                  <td className="px-5 py-3">{column.null_percentage.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Sample rows</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing the first {preview.sample_rows.length} rows from the uploaded dataset.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                {sampleColumns.map((column) => (
                  <th key={column} className="px-5 py-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sample_rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/70 last:border-0">
                  {sampleColumns.map((column) => (
                    <td key={column} className="max-w-64 truncate px-5 py-3 text-muted-foreground">
                      {formatCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">SHA256</p>
        <p className="mt-2 break-all font-mono text-xs">{preview.sha256}</p>
      </section>
    </div>
  );
}
