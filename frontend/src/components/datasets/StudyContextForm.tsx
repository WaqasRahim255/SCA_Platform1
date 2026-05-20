import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { BookOpenCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveStudyContext } from "@/services/api";
import type { StudyContextPayload, StudyContextResponse } from "@/types/api";

interface StudyContextFormProps {
  datasetId: string;
  datasetName: string;
}

const studyTypes = [
  "Observational",
  "Clinical Trial",
  "Registry",
  "Retrospective Cohort",
  "Prospective Cohort",
  "Case Control",
];

function normalizeDate(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return value;

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function StudyContextForm({ datasetId, datasetName }: StudyContextFormProps) {
  const { getToken } = useAuth();
  const storageKey = useMemo(() => `sca-study-context-${datasetId}`, [datasetId]);
  const [form, setForm] = useState<StudyContextPayload>(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved) as StudyContextPayload;
    }

    return {
      dataset_id: datasetId,
      drug_name: "",
      study_type: "",
      indication: "",
      target_population: "",
      study_start_date: null,
      study_end_date: null,
      additional_notes: "",
    };
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedContext, setSavedContext] = useState<StudyContextResponse | null>(null);

  function updateField<K extends keyof StudyContextPayload>(key: K, value: StudyContextPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSavedContext(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const payload = {
      ...form,
      dataset_id: datasetId,
      study_start_date: normalizeDate(form.study_start_date),
      study_end_date: normalizeDate(form.study_end_date),
      additional_notes: form.additional_notes?.trim() ? form.additional_notes : null,
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      const token = await getToken();
      if (!token) {
        throw new Error("You must be signed in to save study context.");
      }

      const response = await saveStudyContext(datasetId, token, payload);
      setSavedContext(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save study context.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-5">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Study context</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Linked dataset: <span className="text-foreground">{datasetName}</span>
        </p>
      </div>

      <form className="grid gap-5 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Drug name
            <input
              required
              value={form.drug_name}
              onChange={(event) => updateField("drug_name", event.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Semaglutide"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Study type
            <select
              required
              value={form.study_type}
              onChange={(event) => updateField("study_type", event.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select study type</option>
              {studyTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Indication
            <input
              required
              value={form.indication}
              onChange={(event) => updateField("indication", event.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Type 2 diabetes"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Target population
            <input
              required
              value={form.target_population}
              onChange={(event) => updateField("target_population", event.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Adults aged 18-75"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Study start date
            <input
              type="date"
              value={form.study_start_date ?? ""}
              onChange={(event) => updateField("study_start_date", event.target.value || null)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Study end date
            <input
              type="date"
              value={form.study_end_date ?? ""}
              onChange={(event) => updateField("study_end_date", event.target.value || null)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          Additional notes
          <textarea
            value={form.additional_notes ?? ""}
            onChange={(event) => updateField("additional_notes", event.target.value)}
            className="min-h-28 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Protocol context, inclusion criteria, exclusions, analysis caveats"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? "Saving..." : "Save Context"}
          </Button>
          {savedContext && (
            <p className="text-sm text-primary">
              {savedContext.message} Browser copy saved locally.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>
    </section>
  );
}
