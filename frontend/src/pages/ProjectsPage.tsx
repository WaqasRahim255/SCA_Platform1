import { useAuth } from "@clerk/clerk-react";
import { FolderKanban, Loader2, Plus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createProject, getProjects } from "@/services/api";
import type { ProjectResponse } from "@/types/api";

export function ProjectsPage() {
  const { getToken, isSignedIn } = useAuth();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      if (!isSignedIn) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("No Clerk token available.");
        }

        const response = await getProjects(token);
        if (isMounted) {
          setProjects(response.projects);
          setError(null);
        }
      } catch (caught) {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Could not load projects.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, [getToken, isSignedIn]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const projectName = name.trim();
    if (!projectName || isCreating) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No Clerk token available.");
      }

      const project = await createProject(token, {
        name: projectName,
        description: description.trim() || null,
      });
      setProjects((currentProjects) => [project, ...currentProjects]);
      setName("");
      setDescription("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create project.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-accent">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Create and resume Plan 1 analysis projects.
          </p>
        </div>
      </div>

      <form className="rounded-lg border border-border bg-card p-5" onSubmit={handleCreateProject}>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_auto] lg:items-end">
          <div>
            <label className="text-sm font-medium" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Clinical analysis project"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="project-description">
              Description
            </label>
            <input
              id="project-description"
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context"
            />
          </div>
          <Button type="submit" disabled={!name.trim() || isCreating}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Create
          </Button>
        </div>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </form>

      {isLoading ? (
        <div className="flex items-center rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Loading projects
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <FolderKanban className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">No projects yet</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Create a project to group dataset context, chat messages, and analysis work.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <article key={project.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <FolderKanban className="mt-1 h-5 w-5 flex-none text-primary" aria-hidden="true" />
                <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                  {project.status}
                </span>
              </div>
              <h2 className="mt-4 text-base font-semibold">{project.name}</h2>
              <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
                {project.description || "No description added."}
              </p>
              <dl className="mt-4 grid gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>Project ID</dt>
                  <dd className="mt-1 break-all font-mono text-foreground">{project.id}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd className="mt-1 text-foreground">
                    {new Date(project.created_at).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
