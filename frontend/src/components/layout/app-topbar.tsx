"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/utils/cx";

const links = [
  { href: "/", label: "Agents" },
  { href: "/speech", label: "Speech" },
  { href: "/concierge", label: "Concierge" },
] as const;

export function AppTopbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-secondary bg-primary/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-md font-semibold tracking-tight text-primary">
          Bond Voice Agent
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

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
      </div>
    </header>
  );
}
