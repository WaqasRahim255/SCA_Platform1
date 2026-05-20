export interface HealthResponse {
  status: "ok";
  service: string;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user: string | null;
  auth: string;
}

export interface DashboardSummaryResponse {
  active_projects: number;
  uploaded_datasets: number;
  active_sessions: number;
  chat_messages: number;
  status: "success";
  message: string;
}

export interface DatasetUploadResponse {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  sha256: string;
  uploaded_at: string;
  rows: number | null;
  columns: number | null;
  status: "success";
  message: string;
}

export interface DatasetMetadataResponse {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  sha256: string;
  uploaded_at: string;
  rows: number | null;
  columns: number | null;
  status: "success";
  message: string;
}

export interface DatasetColumnPreview {
  name: string;
  data_type: string;
  null_percentage: number;
}

export interface DatasetPreviewResponse {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  sha256: string;
  integrity_verified: boolean;
  uploaded_at: string;
  row_count: number;
  column_count: number;
  columns: DatasetColumnPreview[];
  sample_rows: Record<string, string | number | boolean | null>[];
}

export interface CleaningSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  affected_columns: string[];
  affected_rows: number;
  strategy: string;
  confidence: number;
}

export interface DatasetCleaningAnalysisResponse {
  dataset_id: string;
  analysed_at: string;
  row_count: number;
  column_count: number;
  suggestions: CleaningSuggestion[];
  status: "success";
  message: string;
}

export interface DatasetNpsBreakdown {
  column: string;
  total_responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  promoter_percentage: number;
  passive_percentage: number;
  detractor_percentage: number;
  score: number;
}

export interface DatasetNumericSummary {
  column: string;
  count: number;
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  missing: number;
}

export interface DatasetCategoricalSummary {
  column: string;
  unique_values: number;
  top_value: string | null;
  top_count: number;
  missing: number;
}

export interface DatasetAnalysisResponse {
  dataset_id: string;
  analysed_at: string;
  row_count: number;
  column_count: number;
  duplicate_rows: number;
  missing_cells: number;
  missing_cell_percentage: number;
  numeric_columns: number;
  categorical_columns: number;
  nps: DatasetNpsBreakdown | null;
  numeric_summary: DatasetNumericSummary[];
  categorical_summary: DatasetCategoricalSummary[];
  status: "success";
  message: string;
}

export interface DatasetChartResponse {
  dataset_id: string;
  chart_type: "bar" | "scatter";
  title: string;
  x_label: string;
  y_label: string;
  x: Array<string | number | boolean | null>;
  y: Array<string | number | boolean | null>;
  table_columns: string[];
  table_rows: Record<string, string | number | boolean | null>[];
  status: "success";
  message: string;
}

export interface StudyContextPayload {
  dataset_id: string;
  drug_name: string;
  study_type: string;
  indication: string;
  target_population: string;
  study_start_date: string | null;
  study_end_date: string | null;
  additional_notes: string | null;
}

export interface StudyContextResponse extends StudyContextPayload {
  id: string;
  project_id: string;
  saved_to: "database" | "local";
  status: "success";
  message: string;
}

export interface ProjectCreatePayload {
  name: string;
  description: string | null;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
}

export type ChatMode = "planning" | "editing" | "answering";
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessagePayload {
  project_id: string;
  content: string;
  role: ChatRole;
  mode: ChatMode;
  attachment_name: string | null;
}

export interface ChatMessageResponse extends ChatMessagePayload {
  id: string;
  created_at: string;
}

export interface ChatMessagesResponse {
  project_id: string;
  messages: ChatMessageResponse[];
}
