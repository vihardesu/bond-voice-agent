"use client";

import { ArrowRight, CheckCircle, SearchLg } from "@untitledui/icons";

import { Avatar } from "@/components/base/avatar/avatar";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-primary px-4 py-16">
      <section className="flex w-full max-w-lg flex-col gap-8 rounded-2xl bg-primary p-8 shadow-lg ring-1 ring-secondary">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <BadgeWithDot color="success" size="sm" type="pill-color">
              Untitled UI ready
            </BadgeWithDot>
            <Badge color="brand" size="sm" type="pill-color">
              Frontend
            </Badge>
          </div>

          <div className="flex items-start gap-4">
            <Avatar
              size="lg"
              initials="BV"
              alt="Bond Voice"
              status="online"
              contrastBorder
            />
            <div className="flex flex-col gap-1">
              <h1 className="text-display-xs font-semibold text-primary">Hello World</h1>
              <p className="text-md text-tertiary">
                Bond Voice Agent with Untitled UI components wired into the Next.js frontend.
              </p>
            </div>
          </div>
        </header>

        <Input
          label="Try an input"
          placeholder="Search components…"
          hint="Button, badge, avatar, and input from Untitled UI."
          icon={SearchLg}
          size="md"
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button color="secondary" size="lg" iconLeading={CheckCircle}>
            Secondary
          </Button>
          <Button size="lg" iconTrailing={ArrowRight}>
            Primary action
          </Button>
        </div>
      </section>
    </main>
  );
}
