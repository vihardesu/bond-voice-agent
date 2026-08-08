"use client";

import Link from "next/link";
import { ActivityHeart, ArrowRight, Headphones01, Settings01 } from "@untitledui/icons";

import { Badge } from "@/components/base/badges/badges";
import { cx } from "@/utils/cx";

const agents = [
  {
    href: "/speech",
    level: "Level 1",
    title: "Level 1 Agent",
    subtitle: "OpenAI speech-to-speech",
    description:
      "A bare realtime voice loop powered by OpenAI’s latest speech-to-speech model. No custom harness, tools, or prompt layer — just raw conversational audio.",
    model: "gpt-realtime-2.1",
    accent: "from-sky-900 via-slate-800 to-teal-800",
    panel:
      "bg-[radial-gradient(circle_at_20%_20%,rgba(125,211,252,0.35),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(45,212,191,0.28),transparent_40%)]",
    icon: Headphones01,
  },
  {
    href: "/concierge",
    level: "Level 2",
    title: "Level 2 Agent",
    subtitle: "ElevenLabs concierge doctor",
    description:
      "Mira, an empathetic ElevenLabs concierge with a full prompt, empathy dials, clinical context tools, guardrails, and mock care actions for safer next steps.",
    model: "eleven_flash_v2 · gemini-2.5-flash",
    accent: "from-stone-900 via-emerald-950 to-cyan-900",
    panel:
      "bg-[radial-gradient(circle_at_15%_25%,rgba(52,211,153,0.32),transparent_42%),radial-gradient(circle_at_85%_75%,rgba(34,211,238,0.22),transparent_38%)]",
    icon: ActivityHeart,
  },
  {
    href: "/level3",
    level: "Level 3",
    title: "Level 3 Agent",
    subtitle: "Tunable concierge harness",
    description:
      "Save multiple ElevenLabs healthcare concierge variants from typed dials — persona, prompt profile, turn eagerness, voice, LLM, tools — then talk and compare with full Level 2 observability.",
    model: "configurable · turn_v3 · client tools",
    accent: "from-indigo-950 via-slate-900 to-amber-900",
    panel:
      "bg-[radial-gradient(circle_at_18%_22%,rgba(129,140,248,0.34),transparent_44%),radial-gradient(circle_at_82%_78%,rgba(251,191,36,0.22),transparent_40%)]",
    icon: Settings01,
  },
] as const;

export function AgentGallery() {
  return (
    <main className="relative flex min-h-[calc(100dvh-3.5rem)] flex-1 justify-center overflow-hidden px-4 py-12 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(15_23_42/0.06),transparent_55%),linear-gradient(180deg,rgb(248_250_252),rgb(241_245_249))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-24 size-72 rounded-full bg-teal-200/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-10 size-80 rounded-full bg-sky-200/25 blur-3xl"
      />

      <section className="relative z-10 flex w-full max-w-5xl flex-col gap-10">
        <header className="flex max-w-2xl flex-col gap-4 animate-[fade-up_500ms_ease-out_both]">
          <Badge color="brand" size="sm" type="pill-color">
            Bond Voice Agent
          </Badge>
          <div className="flex flex-col gap-3">
            <h1 className="text-display-sm font-semibold tracking-tight text-primary sm:text-display-md">
              Choose who you want to talk to
            </h1>
            <p className="text-lg text-tertiary">
              Three live voice agents. Start with a raw speech-to-speech baseline, step into a
              fixed ElevenLabs concierge harness, or tune and compare Level 3 variants.
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent, index) => {
            const Icon = agent.icon;
            return (
              <Link
                key={agent.href}
                href={agent.href}
                className={cx(
                  "group relative flex min-h-[22rem] flex-col overflow-hidden rounded-3xl text-white shadow-xl ring-1 ring-black/10",
                  "transition duration-300 ease-out",
                  "hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600",
                  "animate-[fade-up_500ms_ease-out_both]",
                )}
                style={{ animationDelay: `${120 + index * 100}ms` }}
              >
                <div className={cx("absolute inset-0 bg-gradient-to-br", agent.accent)} />
                <div className={cx("absolute inset-0", agent.panel)} />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />

                <div className="relative flex h-full flex-col justify-between p-7 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
                        {agent.level}
                      </span>
                      <div className="flex flex-col gap-1">
                        <h2 className="text-display-xs font-semibold tracking-tight">
                          {agent.title}
                        </h2>
                        <p className="text-sm font-medium text-white/75">{agent.subtitle}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-sm transition duration-300 group-hover:scale-105 group-hover:bg-white/15">
                      <Icon className="size-6 text-white" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-5">
                    <p className="max-w-md text-md leading-relaxed text-white/85">
                      {agent.description}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <code className="rounded-lg bg-black/25 px-2.5 py-1.5 text-xs text-white/80 ring-1 ring-white/10">
                        {agent.model}
                      </code>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-all duration-300 group-hover:gap-2.5">
                        Open agent
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
