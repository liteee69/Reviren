"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardSquare01Icon,
  MapsGlobal01Icon,
  Timer01Icon,
  Brain01Icon,
  Cards01Icon,
} from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: DashboardSquare01Icon },
  { href: "/roadmaps", label: "Roadmaps", icon: MapsGlobal01Icon },
  { href: "/sessions", label: "Sessions", icon: Timer01Icon },
  { href: "/feynman", label: "Feynman", icon: Brain01Icon },
  { href: "/flashcards", label: "Flashcards", icon: Cards01Icon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
      <div className="h-16 flex items-center px-6 border-b">
        <span className="text-lg font-semibold tracking-tight">Reviren</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label, icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon icon={icon} className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
