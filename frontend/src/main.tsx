import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/routes";
import "@/index.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function MissingClerkConfig() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="max-w-md rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-medium text-accent">Configuration needed</p>
        <h1 className="mt-2 text-2xl font-semibold">Add your Clerk publishable key</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Create frontend/.env.local and set VITE_CLERK_PUBLISHABLE_KEY to enable
          login and signup.
        </p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <RouterProvider router={router} />
      </ClerkProvider>
    ) : (
      <MissingClerkConfig />
    )}
  </React.StrictMode>,
);
