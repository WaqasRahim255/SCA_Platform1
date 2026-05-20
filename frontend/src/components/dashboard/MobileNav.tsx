import { NavLink } from "react-router-dom";
import { Database, FolderKanban, Home, MessagesSquare } from "lucide-react";
import { cn } from "@/utils/cn";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Datasets", href: "/datasets", icon: Database },
  { label: "Sessions", href: "/sessions", icon: MessagesSquare },
];

export function MobileNav() {
  return (
    <nav className="grid grid-cols-4 border-t border-border bg-background lg:hidden">
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === "/"}
          className={({ isActive }) =>
            cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
              isActive && "text-primary",
            )
          }
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

