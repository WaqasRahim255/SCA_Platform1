import { NavLink } from "react-router-dom";
import { BarChart3, Database, FolderKanban, MessagesSquare } from "lucide-react";
import { cn } from "@/utils/cn";

const navItems = [
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Datasets", href: "/datasets", icon: Database },
  { label: "Sessions", href: "/sessions", icon: MessagesSquare },
];

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-64 border-r border-border bg-background/95 px-4 py-5 lg:block">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">SCA Platform</p>
          <p className="text-xs text-muted-foreground">AI Data Analysis</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "bg-primary/15 text-primary",
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

