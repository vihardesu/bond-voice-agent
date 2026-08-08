"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home01 } from "@untitledui/icons";

import { cx } from "@/utils/cx";

const agentLinks = [
  { href: "/speech", label: "Level 1 Agent" },
  { href: "/concierge", label: "Level 2 Agent" },
  { href: "/level3", label: "Level 3 Agent" },
] as const;

export function AppTopbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-secondary bg-primary/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-md font-semibold tracking-tight text-primary">
          Bond Voice Agent
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1">
          {agentLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-secondary text-primary"
                    : "text-tertiary hover:bg-primary_hover hover:text-secondary_hover",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/"
          className={cx(
            "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
            isHome
              ? "bg-secondary text-primary"
              : "text-tertiary hover:bg-primary_hover hover:text-secondary_hover",
          )}
        >
          <Home01 className="size-4" />
          Home
        </Link>
      </div>
    </header>
  );
}
