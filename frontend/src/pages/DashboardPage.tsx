import { useAuth } from "@clerk/clerk-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { UserButton } from "@clerk/clerk-react";
import {
  Check,
  ChevronDown,
  Code2,
  FileText,
  Loader2,
  Moon,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  analyseDataset,
  analyseDatasetCleaning,
  getChatMessages,
  getDatasetChart,
  getDatasetMetadata,
  getDatasetPreview,
  sendChatMessage,
  uploadDataset,
} from "@/services/api";
import type {
  ChatMessageResponse,
  ChatMode,
  CleaningSuggestion,
  DatasetAnalysisResponse,
  DatasetChartResponse,
  DatasetCleaningAnalysisResponse,
  DatasetPreviewResponse,
  DatasetUploadResponse,
} from "@/types/api";

const PROJECT_ID = "default-project";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".sav"];

type AuditEvent = {
  label: string;
  time: string;
  tone: "green" | "purple" | "blue" | "amber" | "red";
};

const defaultAuditEvents: AuditEvent[] = [
  { label: "Console opened", time: "now", tone: "blue" },
  { label: "Awaiting dataset upload", time: "next", tone: "amber" },
];

const modeLabels: Array<{ id: ChatMode; label: string }> = [
  { id: "planning", label: "Understand" },
  { id: "editing", label: "Modify" },
  { id: "answering", label: "Analyse" },
];

function getExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function getToneClass(tone: AuditEvent["tone"]) {
  const tones: Record<AuditEvent["tone"], string> = {
    green: "border-emerald-500/40 bg-emerald-500/10",
    purple: "border-violet-500/40 bg-violet-500/10",
    blue: "border-sky-500/40 bg-sky-500/10",
    amber: "border-amber-500/40 bg-amber-500/10",
    red: "border-red-500/40 bg-red-500/10",
  };
  return tones[tone];
}

function MetricCard({
  value,
  label,
  count,
  className,
}: {
  value: string;
  label: string;
  count: string;
  className: string;
}) {
  return (
    <div className={`rounded border px-3 py-3 text-center ${className}`}>
      <p className="font-mono text-2xl font-bold">{value}</p>
      <p className="mt-1 font-mono text-xs text-[#5b5974]">{label}</p>
      <p className="mt-1 font-mono text-xs text-[#4b4964]">{count}</p>
    </div>
  );
}

function buildCleaningCode(suggestions: CleaningSuggestion[]) {
  if (suggestions.length === 0) {
    return [
      "# SCA -- operations.py",
      "import pandas as pd",
      "# Upload a dataset, then select cleaning steps.",
      "# Approved code will appear here before execution.",
    ];
  }

  const lines = ["# SCA -- operations.py", "import pandas as pd", "# -- PENDING APPROVAL --"];
  suggestions.forEach((suggestion) => {
    if (suggestion.strategy === "drop_duplicates") {
      lines.push("df = df.drop_duplicates()");
    } else if (suggestion.strategy === "fill_mean") {
      suggestion.affected_columns.forEach((column) => {
        lines.push(`df["${column}"] = df["${column}"].fillna(df["${column}"].mean())`);
      });
    } else if (suggestion.strategy === "fill_median") {
      suggestion.affected_columns.forEach((column) => {
        lines.push(`df["${column}"] = df["${column}"].fillna(df["${column}"].median())`);
      });
    } else if (suggestion.strategy === "fill_mode") {
      suggestion.affected_columns.forEach((column) => {
        lines.push(`df["${column}"] = df["${column}"].fillna(df["${column}"].mode()[0])`);
      });
    } else if (suggestion.strategy === "standardize_title_case") {
      suggestion.affected_columns.forEach((column) => {
        lines.push(`df["${column}"] = df["${column}"].astype(str).str.strip().str.title()`);
      });
    }
  });
  return lines;
}

export function DashboardPage() {
  const { getToken, isSignedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<DatasetUploadResponse | null>(null);
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [analysis, setAnalysis] = useState<DatasetAnalysisResponse | null>(null);
  const [chart, setChart] = useState<DatasetChartResponse | null>(null);
  const [cleaning, setCleaning] = useState<DatasetCleaningAnalysisResponse | null>(null);
  const [selectedCleaningIds, setSelectedCleaningIds] = useState<string[]>([]);
  const [lockedVersion, setLockedVersion] = useState<"v1 RAW" | "v2 CLEAN">("v1 RAW");
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("answering");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(defaultAuditEvents);

  const selectedSuggestions = useMemo(
    () => cleaning?.suggestions.filter((suggestion) => selectedCleaningIds.includes(suggestion.id)) ?? [],
    [cleaning, selectedCleaningIds],
  );
  const codeLines = useMemo(() => buildCleaningCode(selectedSuggestions), [selectedSuggestions]);
  const nps = analysis?.nps ?? null;
  const tableColumns = preview?.columns.slice(0, 4).map((column) => column.name) ?? [
    "Q1",
    "PRIMARY_SPECIALTY",
    "NPS",
    "COMPLETION_TIME",
  ];
  const tableRows = preview?.sample_rows.slice(0, 6) ?? [];
  const currentRows = analysis?.row_count ?? preview?.row_count ?? uploadResult?.rows ?? 0;
  const currentColumns = analysis?.column_count ?? preview?.column_count ?? uploadResult?.columns ?? 0;
  const activeDatasetLabel = uploadResult?.file_name ?? selectedFile?.name ?? "No dataset loaded";
  const statusText = uploadResult
    ? `Dataset locked -- ${lockedVersion} * ${currentRows || "unknown"} rows * Analysis ready`
    : "Upload CSV, Excel, or SPSS to begin";

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      if (!isSignedIn) return;
      try {
        const token = await getToken();
        if (!token) return;
        const response = await getChatMessages(PROJECT_ID, token);
        if (isMounted) setMessages(response.messages);
      } catch {
        if (isMounted) {
          setMessages([]);
        }
      }
    }

    loadMessages();
    return () => {
      isMounted = false;
    };
  }, [getToken, isSignedIn]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  function validateFile(file: File) {
    const extension = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return "Unsupported file type. Upload CSV, Excel, or SPSS files.";
    }
    if (file.size === 0) {
      return "This file is empty. If it is stored in OneDrive, download it locally first, then upload again.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File is larger than the 50MB upload limit.";
    }
    return null;
  }

  function selectFile(file: File | null) {
    if (!file) return;
    const validation = validateFile(file);
    setError(validation);
    setSelectedFile(validation ? null : file);
    setUploadProgress(0);
    if (!validation) {
      setAuditEvents((events) => [
        { label: `Selected ${file.name}`, time: formatTime(), tone: "blue" },
        ...events,
      ]);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);
    setUploadResult(null);
    setPreview(null);
    setAnalysis(null);
    setChart(null);
    setCleaning(null);
    setSelectedCleaningIds([]);
    setLockedVersion("v1 RAW");

    try {
      const token = await getToken();
      if (!token) throw new Error("You must be signed in to upload datasets.");

      const uploaded = await uploadDataset(selectedFile, token, setUploadProgress);
      setUploadResult(uploaded);
      localStorage.setItem("sca:lastDatasetId", uploaded.id);

      await getDatasetMetadata(uploaded.id, token);
      const previewResponse = await getDatasetPreview(uploaded.id, token);
      setPreview(previewResponse);

      const analysisResponse = await analyseDataset(uploaded.id, token);
      setAnalysis(analysisResponse);

      const cleaningResponse = await analyseDatasetCleaning(uploaded.id, token);
      setCleaning(cleaningResponse);
      setSelectedCleaningIds(cleaningResponse.suggestions.map((suggestion) => suggestion.id));

      try {
        setChart(await getDatasetChart(uploaded.id, token));
      } catch {
        setChart(null);
      }

      setAuditEvents((events) => [
        { label: "Dataset uploaded -- v1 RAW", time: formatTime(), tone: "green" },
        { label: "Dataset summary analysed", time: formatTime(), tone: "blue" },
        { label: "Cleaning analysis generated", time: formatTime(), tone: "purple" },
        ...events,
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setAuditEvents((events) => [
        { label: "Upload failed", time: formatTime(), tone: "red" },
        ...events,
      ]);
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  }

  function toggleCleaning(id: string) {
    setSelectedCleaningIds((ids) =>
      ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id],
    );
  }

  function approveCleaning() {
    if (!cleaning || selectedSuggestions.length === 0) return;
    setLockedVersion("v2 CLEAN");
    setAuditEvents((events) => [
      { label: "Cleaning approved -- v2 CLEAN", time: formatTime(), tone: "green" },
      { label: "Dataset locked v2", time: formatTime(), tone: "blue" },
      ...events,
    ]);
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        project_id: PROJECT_ID,
        role: "assistant",
        mode: "editing",
        content: `${selectedSuggestions.length} cleaning step(s) approved. ${lockedVersion === "v2 CLEAN" ? "Dataset remains locked." : "A clean v2 version is now locked for analysis."}`,
        attachment_name: null,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("You must be signed in to chat.");

      const userMessage = await sendChatMessage(token, {
        project_id: PROJECT_ID,
        role: "user",
        mode,
        content,
        attachment_name: null,
      });
      setMessages((current) => [...current, userMessage]);
      setChatInput("");

      const assistantText = uploadResult
        ? `Running in ${mode} mode on ${lockedVersion}. Dataset ${uploadResult.file_name} has ${currentRows || "unknown"} rows and ${currentColumns || "unknown"} columns. ${analysis?.nps ? `NPS is ${analysis.nps.score} from ${analysis.nps.total_responses} responses.` : "No NPS-style 0-10 recommendation column was detected."} ${cleaning?.suggestions.length ? `${cleaning.suggestions.length} cleaning suggestions are available in the approval panel.` : "No basic cleaning suggestions are pending."}`
        : "Upload a dataset first, then I can help classify intent, plan cleaning, and prepare analysis code.";

      const assistantMessage = await sendChatMessage(token, {
        project_id: PROJECT_ID,
        role: "assistant",
        mode,
        content: assistantText,
        attachment_name: null,
      });
      setMessages((current) => [...current, assistantMessage]);
      setAuditEvents((events) => [
        { label: `Chat message classified -- ${mode}`, time: formatTime(), tone: "purple" },
        ...events,
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#05050c] font-mono text-[#aaa8bd]">
      <header className="grid h-14 grid-cols-[300px_minmax(720px,1fr)_396px] border-b border-[#c7c5dc] bg-[#090911]">
        <div className="flex items-center px-3 text-xl font-semibold tracking-[0.22em] text-[#7b65e8]">
          SCA<span className="text-emerald-500">.</span>
        </div>
        <div />
        <div className="flex items-center justify-end gap-2 px-3">
          <button className="flex h-8 w-8 items-center justify-center rounded border border-[#252440] bg-[#151426] text-[#5d5a7c]">
            <Moon className="h-4 w-4" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded border border-[#252440] bg-[#151426] text-[#5d5a7c]">
            <Settings className="h-4 w-4" />
          </button>
          <UserButton afterSignOutUrl="/login" />
        </div>
      </header>

      <div className="border-b border-[#1f5b3b] bg-[#0b2116] py-2 text-center text-sm font-semibold tracking-wide text-[#50bd77]">
        <ShieldCheck className="mr-2 inline h-3.5 w-3.5" />
        {statusText}
      </div>

      <main className="grid h-[calc(100vh-94px)] grid-cols-[300px_minmax(760px,1fr)_396px]">
        <aside className="min-h-0 overflow-y-auto border-r border-[#c7c5dc] bg-[#070711]">
          <div
            className="p-1.5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectFile(event.dataTransfer.files.item(0));
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.sav"
              onChange={(event) => selectFile(event.target.files?.item(0) ?? null)}
            />
            <button
              className="flex h-10 w-full items-center gap-2 rounded border border-dashed border-[#26233f] px-4 text-left text-sm text-[#6b6685] hover:border-[#4a4568] hover:text-[#aaa8bd]"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Upload Dataset
            </button>
          </div>

          <div className="px-3 py-3">
            <div className="mb-3 flex items-start gap-2 text-sm text-[#aaa8bd]">
              <FileText className="mt-0.5 h-4 w-4 flex-none text-[#777391]" />
              <span className="break-all">{activeDatasetLabel}</span>
            </div>
            <div className="ml-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-[#777391]">
                <span className="h-2 w-2 rounded-full bg-[#57536f]" />
                v1 RAW{" "}
                <span className="border border-[#282447] bg-[#151326] px-2 text-xs">
                  {uploadResult?.rows ?? 0}r
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#aaa8bd]">
                <span className="h-2 w-2 rounded-full bg-[#62d67f]" />
                {lockedVersion === "v2 CLEAN" ? "v2 -- cleaning approved" : "v2 -- pending clean"}
                <span className="border border-emerald-600/40 bg-emerald-500/10 px-2 text-xs text-[#5ed47e]">
                  {currentRows || 0}r
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#c7c5dc] px-2 py-3">
            <div className="mb-4 flex items-center justify-between text-xs tracking-[0.22em] text-[#3f3b58]">
              <span>AUDIT LOG</span>
              <span className="tracking-normal">Export</span>
            </div>
            <div className="space-y-5">
              {auditEvents.map((event, index) => (
                <div key={`${event.label}-${index}`} className="flex gap-3">
                  <span className={`h-6 w-6 rounded border ${getToneClass(event.tone)}`} />
                  <div>
                    <p className="text-sm text-[#aaa8bd]">{event.label}</p>
                    <p className="mt-1 text-sm text-[#5c5873]">{event.time}</p>
                  </div>
                  {index === 0 ? <ChevronDown className="ml-auto mt-1 h-4 w-4 text-[#4d4964]" /> : null}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="grid min-h-0 grid-rows-[44px_324px_44px_250px_46px_1fr] bg-[#070711]">
          <div className="flex items-center border-b border-[#c7c5dc] px-3 text-xs tracking-[0.22em] text-[#35314e]">
            RESULTS
          </div>

          <div className="relative overflow-y-auto border-b border-[#c7c5dc] p-3">
            <div className="grid gap-3 xl:grid-cols-[514px_1fr]">
              <div className="rounded-md border border-[#292740] bg-[#111020] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <span className="border border-amber-700/70 bg-amber-500/10 px-2 py-1 text-xs text-amber-500">
                    {nps ? "NPS" : "DATA"}
                  </span>
                  <span>{nps ? "NPS - Likelihood to Recommend" : "Dataset Summary"}</span>
                </div>
                {nps ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <MetricCard
                        value={`${nps.promoter_percentage}%`}
                        label="Promoters"
                        count={`n=${nps.promoters}`}
                        className="border-emerald-500/30 bg-emerald-500/10 text-[#62d67f]"
                      />
                      <MetricCard
                        value={`${nps.passive_percentage}%`}
                        label="Passives"
                        count={`n=${nps.passives}`}
                        className="border-amber-600/30 bg-amber-500/10 text-[#e5a832]"
                      />
                      <MetricCard
                        value={`${nps.detractor_percentage}%`}
                        label="Detractors"
                        count={`n=${nps.detractors}`}
                        className="border-red-500/30 bg-red-500/10 text-[#dc5e59]"
                      />
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <p className="text-3xl font-bold text-[#e5a832]">{nps.score}</p>
                      <p className="text-sm text-[#4b4964]">
                        {nps.column} * n={nps.total_responses}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <MetricCard
                      value={String(currentRows || "--")}
                      label="Rows"
                      count={lockedVersion}
                      className="border-emerald-500/30 bg-emerald-500/10 text-[#62d67f]"
                    />
                    <MetricCard
                      value={String(currentColumns || "--")}
                      label="Columns"
                      count={uploadResult?.file_type ?? "file"}
                      className="border-amber-600/30 bg-amber-500/10 text-[#e5a832]"
                    />
                    <MetricCard
                      value={cleaning ? String(cleaning.suggestions.length) : "--"}
                      label="Clean steps"
                      count="pending"
                      className="border-red-500/30 bg-red-500/10 text-[#dc5e59]"
                    />
                  </div>
                )}
                <div className="mt-4 border-t border-[#4d4964] pt-3 text-xs text-[#49455f]">
                  {lockedVersion} * {currentRows || "no"} rows * {uploadResult ? "locked" : "waiting"}
                </div>
              </div>

              <div className="rounded-md border border-[#292740] bg-[#0d0c18] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm tracking-[0.18em] text-[#4a4663]">UPLOAD PIPELINE</p>
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> : null}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#19172b]">
                  <div className="h-full bg-[#62d67f]" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[#777391]">
                  <p>File: {selectedFile ? `${selectedFile.name} (${formatBytes(selectedFile.size)})` : "none selected"}</p>
                  <p>SHA256: {uploadResult?.sha256 ?? "created after upload"}</p>
                  <p>Chart: {chart?.title ?? "generated after upload when plottable"}</p>
                </div>
                {analysis ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-[#292740] bg-[#111020] p-2">
                      <p className="text-[#4a4663]">Missing cells</p>
                      <p className="mt-1 text-[#aaa8bd]">
                        {analysis.missing_cells} ({analysis.missing_cell_percentage}%)
                      </p>
                    </div>
                    <div className="rounded border border-[#292740] bg-[#111020] p-2">
                      <p className="text-[#4a4663]">Duplicates</p>
                      <p className="mt-1 text-[#aaa8bd]">{analysis.duplicate_rows}</p>
                    </div>
                    <div className="rounded border border-[#292740] bg-[#111020] p-2">
                      <p className="text-[#4a4663]">Numeric cols</p>
                      <p className="mt-1 text-[#aaa8bd]">{analysis.numeric_columns}</p>
                    </div>
                    <div className="rounded border border-[#292740] bg-[#111020] p-2">
                      <p className="text-[#4a4663]">Category cols</p>
                      <p className="mt-1 text-[#aaa8bd]">{analysis.categorical_columns}</p>
                    </div>
                  </div>
                ) : null}
                <button
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-[#67c58b] px-3 py-2 text-sm font-bold text-[#062014] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!selectedFile || isUploading}
                  onClick={handleUpload}
                  type="button"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isUploading ? "Uploading dataset" : "Upload and analyse cleaning"}
                </button>
                {error ? <p className="mt-3 text-sm text-[#d35b5b]">{error}</p> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-[#c7c5dc] px-3 text-xs tracking-[0.22em] text-[#35314e]">
            DATASET
            <span className="border border-amber-700/60 bg-amber-500/10 px-2 py-1 tracking-normal text-amber-500">
              {lockedVersion} * {currentRows || 0} rows
            </span>
          </div>

          <div className="overflow-auto border-b border-[#c7c5dc]">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-[#5b5873] text-xs tracking-wider text-[#55516d]">
                <tr>
                  {tableColumns.map((column) => (
                    <th key={column} className="px-3 py-2 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[#6f6b8c]">
                {tableRows.length === 0 ? (
                  <tr className="border-b border-[#5b5873]">
                    <td className="px-3 py-8 text-center text-[#4a4663]" colSpan={tableColumns.length}>
                      Upload a dataset to preview rows here.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-[#5b5873]">
                      {tableColumns.map((column) => (
                        <td key={column} className="max-w-64 truncate px-3 py-2">
                          {formatCell(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-b border-[#c7c5dc] px-3">
            <div className="flex items-center gap-2">
              <span className="text-sm tracking-wider text-[#aaa8bd]">OPERATIONS.PY</span>
              <span className="border border-emerald-600/40 bg-emerald-500/10 px-2 py-1 text-xs text-[#62d67f]">
                Python
              </span>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded border border-[#26233f] px-3 py-1 text-xs text-[#393653]"
                type="button"
              >
                Run selection
              </button>
              <button
                className="rounded border border-[#26233f] px-3 py-1 text-xs text-[#393653]"
                type="button"
              >
                Export script
              </button>
            </div>
          </div>

          <div className="relative overflow-auto bg-[#030308] p-5">
            <div className="absolute left-2 top-14 h-12 w-1 bg-[#5ed47e]" />
            <div className="space-y-2 text-sm">
              {codeLines.map((line, index) => (
                <div key={`${line}-${index}`} className="grid grid-cols-[42px_1fr]">
                  <span className="text-right text-[#34314a]">{index + 1}</span>
                  <span
                    className={
                      line.includes("APPROVAL") || line.startsWith("df")
                        ? "pl-3 text-[#56c777]"
                        : "pl-3 text-[#34314a]"
                    }
                  >
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="grid min-h-0 grid-rows-[50px_minmax(0,1fr)_218px] border-l border-[#c7c5dc] bg-[#070711]">
          <div className="flex items-center border-b border-[#c7c5dc] px-3 text-xs tracking-[0.22em] text-[#35314e]">
            AI ASSISTANT <span className="ml-2 h-2 w-2 rounded-full bg-[#62d67f]" />
          </div>

          <div className="space-y-4 overflow-y-auto p-3">
            <div className="rounded border border-[#aaa8bd] bg-[#12111f] p-3 text-sm leading-6">
              <Check className="mr-1 inline h-4 w-4" />
              {uploadResult
                ? `Dataset ${uploadResult.file_name} uploaded. Review cleaning steps before locking v2.`
                : "Upload a dataset to start the compliant analysis workflow."}
            </div>

            {analysis ? (
              <div className="rounded border border-[#292740] bg-[#0d0c18] p-3">
                <div className="mb-3 w-fit border border-emerald-600/50 bg-emerald-500/10 px-2 py-1 text-xs text-[#62d67f]">
                  DATA SUMMARY
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-[#292740] bg-[#111020] p-2">
                    <p className="text-[#4a4663]">Rows</p>
                    <p className="mt-1 text-[#aaa8bd]">{analysis.row_count}</p>
                  </div>
                  <div className="rounded border border-[#292740] bg-[#111020] p-2">
                    <p className="text-[#4a4663]">Columns</p>
                    <p className="mt-1 text-[#aaa8bd]">{analysis.column_count}</p>
                  </div>
                </div>
                {analysis.numeric_summary[0] ? (
                  <div className="mt-3 rounded border border-[#292740] bg-[#111020] p-2 text-xs leading-5">
                    <p className="text-[#4a4663]">Primary numeric</p>
                    <p className="text-[#aaa8bd]">{analysis.numeric_summary[0].column}</p>
                    <p className="text-[#686482]">
                      mean {analysis.numeric_summary[0].mean ?? "n/a"} * median{" "}
                      {analysis.numeric_summary[0].median ?? "n/a"} * range{" "}
                      {analysis.numeric_summary[0].minimum ?? "n/a"}-
                      {analysis.numeric_summary[0].maximum ?? "n/a"}
                    </p>
                  </div>
                ) : null}
                {analysis.categorical_summary[0] ? (
                  <div className="mt-2 rounded border border-[#292740] bg-[#111020] p-2 text-xs leading-5">
                    <p className="text-[#4a4663]">Primary category</p>
                    <p className="text-[#aaa8bd]">{analysis.categorical_summary[0].column}</p>
                    <p className="text-[#686482]">
                      top {analysis.categorical_summary[0].top_value ?? "n/a"} (
                      {analysis.categorical_summary[0].top_count}) * unique{" "}
                      {analysis.categorical_summary[0].unique_values}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {cleaning ? (
              <div className="rounded border border-amber-700/50 bg-[#100d08] p-3">
                <div className="mb-3 w-fit border border-amber-700/60 bg-amber-500/10 px-2 py-1 text-xs text-amber-500">
                  CLEANING
                </div>
                <div className="space-y-2">
                  {cleaning.suggestions.length === 0 ? (
                    <p className="text-sm text-[#686482]">No basic cleaning suggestions were found.</p>
                  ) : (
                    cleaning.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        className="flex w-full items-start gap-3 rounded border border-[#292740] bg-[#111020] p-3 text-left"
                        onClick={() => toggleCleaning(suggestion.id)}
                        type="button"
                      >
                        <span
                          className={`mt-1 flex h-4 w-4 flex-none items-center justify-center rounded border ${
                            selectedCleaningIds.includes(suggestion.id)
                              ? "border-[#62d67f] bg-[#62d67f] text-[#062014]"
                              : "border-[#4a4663]"
                          }`}
                        >
                          {selectedCleaningIds.includes(suggestion.id) ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span>
                          <span className="block text-sm text-[#aaa8bd]">{suggestion.title}</span>
                          <span className="mt-1 block text-xs leading-5 text-[#686482]">
                            {suggestion.affected_rows} row(s), {suggestion.affected_columns.join(", ")}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <p className="mt-4 text-sm font-semibold text-amber-500">
                  {currentRows || 0} -&gt; {currentRows || 0} rows after selected cleaning
                </p>
                <button
                  className="mt-4 w-full rounded bg-[#67c58b] px-4 py-3 text-center font-bold text-[#062014] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={selectedSuggestions.length === 0}
                  onClick={approveCleaning}
                  type="button"
                >
                  <Check className="mr-2 inline h-4 w-4" />
                  Approve cleaning and lock v2
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded border border-[#26233f] px-3 py-2 text-xs text-[#393653]" type="button">
                    <Code2 className="mr-2 inline h-3.5 w-3.5" />
                    Edit Code
                  </button>
                  <button
                    className="rounded border border-red-500/30 px-3 py-2 text-xs text-[#d35b5b]"
                    onClick={() => setSelectedCleaningIds([])}
                    type="button"
                  >
                    <X className="mr-1 inline h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded border p-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-6 border-[#292740] bg-[#151426] text-[#8e8aa6]"
                    : "mr-6 border-[#aaa8bd] bg-[#12111f] text-[#aaa8bd]"
                }`}
              >
                <div className="mb-1 text-xs uppercase tracking-wider text-[#4a4663]">
                  {message.mode} / {message.role}
                </div>
                {message.content}
              </div>
            ))}
            {isSending ? (
              <div className="flex items-center gap-2 text-sm text-[#686482]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking
              </div>
            ) : null}
            <div ref={chatBottomRef} />
          </div>

          <form className="border-t border-[#c7c5dc] p-3" onSubmit={handleSendMessage}>
            <div className="mb-3 flex items-center gap-1 text-xs">
              {modeLabels.map((item) => (
                <button
                  key={item.id}
                  className={
                    mode === item.id
                      ? "border border-amber-700/70 bg-amber-500/10 px-2 py-1 text-amber-500"
                      : "border border-[#26233f] px-2 py-1 text-[#393653]"
                  }
                  onClick={() => setMode(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
              <span className="ml-auto border border-emerald-600/50 bg-emerald-500/10 px-2 py-1 text-[#62d67f]">
                {lockedVersion}
              </span>
            </div>
            <button className="mb-2 border border-amber-700/70 bg-amber-500/10 px-2 py-1 text-xs text-amber-500" type="button">
              {mode.toUpperCase()} <ChevronDown className="inline h-3.5 w-3.5" />
            </button>
            <div className="flex gap-2">
              <textarea
                className="h-16 min-w-0 flex-1 resize-none rounded border border-[#292740] bg-[#111020] px-3 py-3 text-sm outline-none placeholder:text-[#4a4663]"
                placeholder="Ask anything about your data..."
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button
                className="flex h-16 w-12 flex-none items-center justify-center rounded border border-[#292740] bg-[#151426] text-[#62d67f] disabled:text-[#393653]"
                disabled={!chatInput.trim() || isSending}
                type="submit"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </aside>
      </main>
    </div>
  );
}
