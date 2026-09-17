"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/primitives";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  COUNSELOR_CHECKLIST,
  COUNSELOR_PAGES,
  FACULTY_CHECKLIST,
  FACULTY_PAGES,
  HEAD_CHECKLIST,
  HEAD_PAGES,
} from "@/lib/about-content";
import { PageAccordion } from "@/components/about/page-accordion";
import { ChecklistSection, PipelineSection, RulesSection } from "@/components/about/handbook-sections";

function AboutBreadcrumb() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>About</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * /about — the in-app handbook, strictly role-scoped: counselors only ever
 * see the counselor guide, the head only ever sees the head guide, and
 * faculty only ever see the faculty guide. No tabs, no cross-viewing.
 * Pipelines, per-page reference (what is displayed, what your role may do,
 * where the work goes next), and the non-negotiable rules.
 */
export default function AboutPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setRole((profile as { role: string } | null)?.role ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isHead = role === "guidance_head";
  const isFaculty = role === "faculty";

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <AboutBreadcrumb />
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">About this workspace</h1>
          <p className="mt-1 text-sm text-ink-muted">Loading your handbook…</p>
        </div>
        <div className="animate-pulse space-y-3" aria-hidden>
          <div className="h-32 rounded-lg bg-ink/10" />
          <div className="h-24 rounded-lg bg-ink/10" />
          <div className="h-24 rounded-lg bg-ink/10" />
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <AboutBreadcrumb />
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">About this workspace</h1>
        </div>
        <Card>
          <p className="text-sm font-bold text-ink">Built for the counseling team</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            This handbook documents the counselor, head, and faculty workflows. Your home is the
            Dashboard — your referrals, their status, and your outcomes live there.
          </p>
          <Link href="/dashboard" className="mt-2 inline-block text-[13px] font-bold text-primary-700 hover:underline">
            Open Dashboard →
          </Link>
        </Card>
      </div>
    );
  }
  const pages = isHead ? HEAD_PAGES : isFaculty ? FACULTY_PAGES : COUNSELOR_PAGES;
  const checklist = isHead ? HEAD_CHECKLIST : isFaculty ? FACULTY_CHECKLIST : COUNSELOR_CHECKLIST;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <AboutBreadcrumb />

      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">About this workspace</h1>
        <p className="mx-auto mt-1 max-w-[640px] text-sm leading-relaxed text-ink-muted">
          {isHead
            ? "The head handbook — the whole office: how cases move, what each page shows, what you may touch, and where every action goes next."
            : isFaculty
              ? "Your faculty handbook — your referrals, your pipeline, your rules: how cases move, what each page shows, what you may touch, and where every action goes next."
              : "Your counselor handbook — your queues, your pipeline, your rules: how cases move, what each page shows, what you may touch, and where every action goes next."}
        </p>
      </div>

      {/* Master pipeline — the two flows everything else serves. */}
      <PipelineSection />

      {/* Daily checklist */}
      <ChecklistSection
        isHead={isHead}
        checklist={checklist}
        title={isFaculty ? "Faculty daily checklist" : undefined}
      />

      {/* Page-by-page reference */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            {isHead ? "Every page, head view" : isFaculty ? "Every page, faculty view" : "Every page, counselor view"}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Open a page to see its purpose, exactly what is displayed, what you may do, and where the work goes next.
          </p>
        </div>
        {pages.map((doc) => (
          <PageAccordion key={doc.href + doc.label} doc={doc} />
        ))}
      </section>

      {/* Non-negotiable rules — scoped to your role, like the rest of this guide. */}
      <RulesSection isHead={isHead} isFaculty={isFaculty} />
    </div>
  );
}
