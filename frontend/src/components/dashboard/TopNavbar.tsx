import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { BarChart3, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopNavbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold">SCA Platform</span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-card px-3 text-muted-foreground lg:flex">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            aria-label="Search"
            placeholder="Search projects, datasets, sessions"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </Button>
          <UserButton afterSignOutUrl="/login" />
        </div>
      </div>
    </header>
  );
}

