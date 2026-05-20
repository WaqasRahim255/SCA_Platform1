import { useAuth } from "@clerk/clerk-react";
import { BarChart3, Loader2, RefreshCw, Table2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getDatasetChart } from "@/services/api";
import type { DatasetChartResponse } from "@/types/api";

const LAST_DATASET_ID_KEY = "sca:lastDatasetId";
const PLOTLY_CDN_URL = "https://cdn.plot.ly/plotly-2.35.2.min.js";

type PlotlyApi = {
  react: (
    root: HTMLElement,
    data: unknown[],
    layout?: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<HTMLElement>;
  purge: (root: HTMLElement) => void;
};

declare global {
  interface Window {
    Plotly?: PlotlyApi;
  }
}

function loadPlotly() {
  if (window.Plotly) {
    return Promise.resolve(window.Plotly);
  }

  return new Promise<PlotlyApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${PLOTLY_CDN_URL}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.Plotly) {
          resolve(window.Plotly);
        } else {
          reject(new Error("Plotly loaded but was not available."));
        }
      });
      existingScript.addEventListener("error", () => reject(new Error("Could not load Plotly.")));
      return;
    }

    const script = document.createElement("script");
    script.src = PLOTLY_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.Plotly) {
        resolve(window.Plotly);
      } else {
        reject(new Error("Plotly loaded but was not available."));
      }
    };
    script.onerror = () => reject(new Error("Could not load Plotly."));
    document.head.appendChild(script);
  });
}

export function DatasetChart() {
  const { getToken, isSignedIn } = useAuth();
  const chartRef = useRef<HTMLDivElement>(null);
  const [datasetId, setDatasetId] = useState(() => localStorage.getItem(LAST_DATASET_ID_KEY) ?? "");
  const [activeDatasetId, setActiveDatasetId] = useState(datasetId);
  const [chart, setChart] = useState<DatasetChartResponse | null>(null);
  const [plotly, setPlotly] = useState<PlotlyApi | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plotData = useMemo(() => {
    if (!chart) return [];

    if (chart.chart_type === "scatter") {
      return [
        {
          type: "scatter",
          mode: "markers",
          x: chart.x,
          y: chart.y,
          marker: { color: "#00a77f", size: 9, opacity: 0.82 },
        },
      ];
    }

    return [
      {
        type: "bar",
        x: chart.x,
        y: chart.y,
        marker: { color: "#00a77f" },
      },
    ];
  }, [chart]);

  useEffect(() => {
    if (!activeDatasetId || !isSignedIn) {
      return;
    }

    let isMounted = true;

    async function loadChart() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("You must be signed in to load dataset charts.");
        }

        const response = await getDatasetChart(activeDatasetId, token);
        if (isMounted) {
          setChart(response);
          setDatasetId(response.dataset_id);
          localStorage.setItem(LAST_DATASET_ID_KEY, response.dataset_id);
        }
      } catch (caught) {
        if (isMounted) {
          setChart(null);
          setError(caught instanceof Error ? caught.message : "Could not load chart data.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadChart();

    return () => {
      isMounted = false;
    };
  }, [activeDatasetId, getToken, isSignedIn]);

  useEffect(() => {
    let isMounted = true;

    loadPlotly()
      .then((plotlyApi) => {
        if (isMounted) {
          setPlotly(plotlyApi);
        }
      })
      .catch((caught) => {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Could not load Plotly.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !chart || !plotly) {
      return;
    }

    plotly.react(chartRef.current, plotData, {
      title: { text: chart.title, font: { color: "#ffffff", size: 16 } },
      autosize: true,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#d7dee8" },
      margin: { l: 56, r: 24, t: 52, b: 56 },
      xaxis: {
        title: { text: chart.x_label },
        gridcolor: "rgba(255,255,255,0.08)",
        zerolinecolor: "rgba(255,255,255,0.16)",
      },
      yaxis: {
        title: { text: chart.y_label },
        gridcolor: "rgba(255,255,255,0.08)",
        zerolinecolor: "rgba(255,255,255,0.16)",
      },
    }, {
      displaylogo: false,
      responsive: true,
    });

    return () => {
      if (chartRef.current) {
        plotly.purge(chartRef.current);
      }
    };
  }, [chart, plotData, plotly]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDatasetId = datasetId.trim();
    if (nextDatasetId) {
      setActiveDatasetId(nextDatasetId);
    }
  }

  const tableColumns = chart?.table_columns.slice(0, 6) ?? [];

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-col justify-between gap-4 border-b border-border p-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Dataset chart</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Interactive Plotly view for an uploaded dataset.
          </p>
        </div>

        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
          <input
            className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring sm:w-80"
            placeholder="Paste dataset id"
            value={datasetId}
            onChange={(event) => setDatasetId(event.target.value)}
          />
          <Button type="submit" disabled={!datasetId.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Load Chart
          </Button>
        </form>
      </div>

      <div className="p-5">
        {!activeDatasetId && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-base font-semibold">Upload a dataset to chart it</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              After upload, the dashboard remembers the dataset id. You can also paste one here.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Loading chart data
          </div>
        )}

        {chart && !isLoading && (
          <div className="space-y-5">
            <div ref={chartRef} className="min-h-96 w-full" />

            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Table2 className="h-4 w-4 text-accent" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Sample table</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      {tableColumns.map((column) => (
                        <th key={column} className="px-4 py-3 font-medium">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.table_rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border/70 last:border-0">
                        {tableColumns.map((column) => (
                          <td key={column} className="max-w-64 truncate px-4 py-3 text-muted-foreground">
                            {row[column] === null || row[column] === undefined
                              ? "NULL"
                              : String(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
