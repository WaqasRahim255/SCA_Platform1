import { useState } from "react";
import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CleaningSuggestion, DatasetCleaningAnalysisResponse } from "@/types/api";
import { cn } from "@/utils/cn";

type Decision = "pending" | "approved" | "rejected";

interface CleaningSuggestionsProps {
  analysis: DatasetCleaningAnalysisResponse;
}

function suggestionLabel(suggestion: CleaningSuggestion) {
  if (suggestion.type === "duplicates") return "Duplicates";
  if (suggestion.type === "missing_values") return "Missing values";
  if (suggestion.type === "text_casing") return "Text casing";
  return "Cleaning";
}

export function CleaningSuggestions({ analysis }: CleaningSuggestionsProps) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(analysis.suggestions.map((suggestion) => [suggestion.id, "pending"])),
  );

  function setDecision(id: string, decision: Decision) {
    setDecisions((current) => ({ ...current, [id]: decision }));
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Cleaning suggestions</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{analysis.message}</p>
      </div>

      {analysis.suggestions.length === 0 ? (
        <div className="p-5 text-sm text-muted-foreground">
          No duplicate rows, missing values, or inconsistent text casing were detected.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {analysis.suggestions.map((suggestion) => {
            const decision = decisions[suggestion.id] ?? "pending";

            return (
              <article key={suggestion.id} className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                        {suggestionLabel(suggestion)}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-1 text-xs font-medium",
                          decision === "approved" && "bg-primary/15 text-primary",
                          decision === "rejected" && "bg-destructive/15 text-destructive",
                          decision === "pending" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {decision}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold">{suggestion.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {suggestion.description}
                    </p>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Affected rows</dt>
                        <dd className="mt-1 font-medium">{suggestion.affected_rows}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Strategy</dt>
                        <dd className="mt-1 font-medium">{suggestion.strategy}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Confidence</dt>
                        <dd className="mt-1 font-medium">
                          {Math.round(suggestion.confidence * 100)}%
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 break-words text-xs text-muted-foreground">
                      Columns: {suggestion.affected_columns.join(", ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => setDecision(suggestion.id, "approved")}
                      type="button"
                    >
                      <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDecision(suggestion.id, "rejected")}
                      type="button"
                    >
                      <X className="mr-2 h-4 w-4" aria-hidden="true" />
                      Reject
                    </Button>
                    {decision !== "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDecision(suggestion.id, "pending")}
                        type="button"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
