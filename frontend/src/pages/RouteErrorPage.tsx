import { Link, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function RouteErrorPage() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : "The page you requested could not be loaded.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="max-w-md rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-medium text-accent">Page unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold">Something went off route</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <Button asChild className="mt-6">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </section>
    </main>
  );
}

