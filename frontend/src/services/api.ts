const API_URL = import.meta.env.VITE_API_URL ?? "https://sca-platform1-1.onrender.com";
export { API_URL };

function formatApiError(payload: unknown, fallback: string) {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) {
    return fallback;
  }

  const detail = (payload as { detail: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item !== "object" || item === null || !("msg" in item)) {
          return "Validation error";
        }

        const location =
          "loc" in item && Array.isArray((item as { loc: unknown }).loc)
            ? (item as { loc: Array<string | number> }).loc.join(".")
            : "field";
        return `${location}: ${String((item as { msg: unknown }).msg)}`;
      })
      .join("; ");
  }

  return fallback;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new Error(formatApiError(payload, `API request failed: ${response.status}`));
  }

  return response.json() as Promise<T>;
}

export async function authenticatedApiFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function getDatasetPreview(
  datasetId: string,
  token: string,
): Promise<import("@/types/api").DatasetPreviewResponse> {
  return authenticatedApiFetch<import("@/types/api").DatasetPreviewResponse>(
    `/api/datasets/${datasetId}/preview`,
    token,
  );
}

export async function getDashboardSummary(
  token: string,
): Promise<import("@/types/api").DashboardSummaryResponse> {
  return authenticatedApiFetch<import("@/types/api").DashboardSummaryResponse>(
    "/api/dashboard/summary",
    token,
  );
}

export async function getDatasetMetadata(
  datasetId: string,
  token: string,
): Promise<import("@/types/api").DatasetMetadataResponse> {
  return authenticatedApiFetch<import("@/types/api").DatasetMetadataResponse>(
    `/api/datasets/${datasetId}`,
    token,
  );
}

export async function analyseDatasetCleaning(
  datasetId: string,
  token: string,
): Promise<import("@/types/api").DatasetCleaningAnalysisResponse> {
  return authenticatedApiFetch<import("@/types/api").DatasetCleaningAnalysisResponse>(
    `/api/datasets/${datasetId}/clean/analyse`,
    token,
    { method: "POST" },
  );
}

export async function analyseDataset(
  datasetId: string,
  token: string,
): Promise<import("@/types/api").DatasetAnalysisResponse> {
  return authenticatedApiFetch<import("@/types/api").DatasetAnalysisResponse>(
    `/api/datasets/${datasetId}/analysis`,
    token,
  );
}

export async function getDatasetChart(
  datasetId: string,
  token: string,
): Promise<import("@/types/api").DatasetChartResponse> {
  return authenticatedApiFetch<import("@/types/api").DatasetChartResponse>(
    `/api/datasets/${datasetId}/chart`,
    token,
  );
}

export async function saveStudyContext(
  projectId: string,
  token: string,
  payload: import("@/types/api").StudyContextPayload,
): Promise<import("@/types/api").StudyContextResponse> {
  return authenticatedApiFetch<import("@/types/api").StudyContextResponse>(
    `/api/projects/${projectId}/context`,
    token,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function createProject(
  token: string,
  payload: import("@/types/api").ProjectCreatePayload,
): Promise<import("@/types/api").ProjectResponse> {
  return authenticatedApiFetch<import("@/types/api").ProjectResponse>("/api/projects", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProjects(
  token: string,
): Promise<import("@/types/api").ProjectListResponse> {
  return authenticatedApiFetch<import("@/types/api").ProjectListResponse>("/api/projects", token);
}

export async function getChatMessages(
  projectId: string,
  token: string,
): Promise<import("@/types/api").ChatMessagesResponse> {
  return authenticatedApiFetch<import("@/types/api").ChatMessagesResponse>(
    `/api/chat/messages/${projectId}`,
    token,
  );
}

export async function sendChatMessage(
  token: string,
  payload: import("@/types/api").ChatMessagePayload,
): Promise<import("@/types/api").ChatMessageResponse> {
  return authenticatedApiFetch<import("@/types/api").ChatMessageResponse>(
    "/api/chat/messages",
    token,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function uploadDataset(
  file: File,
  token: string,
  onProgress: (progress: number) => void,
): Promise<import("@/types/api").DatasetUploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", `${API_URL}/api/datasets/upload`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        payload = null;
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(payload as import("@/types/api").DatasetUploadResponse);
        return;
      }

      reject(new Error(formatApiError(payload, `Upload failed with status ${request.status}`)));
    };

    request.onerror = () => reject(new Error("Upload failed due to a network error."));
    request.send(formData);
  });
}
