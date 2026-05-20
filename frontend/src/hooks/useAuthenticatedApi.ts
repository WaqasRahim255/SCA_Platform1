import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { authenticatedApiFetch } from "@/services/api";

export function useAuthenticatedApi<T>(path: string) {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!isSignedIn) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("No Clerk token available.");
        }

        const response = await authenticatedApiFetch<T>(path, token);
        if (isMounted) {
          setData(response);
          setError(null);
        }
      } catch (caught) {
        if (isMounted) {
          setError(caught instanceof Error ? caught : new Error("Authenticated API failed."));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [getToken, isSignedIn, path]);

  return { data, error, isLoading };
}
