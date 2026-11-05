"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";

const links = [
  { label: "The Problem", href: "#problem" },
  { label: "Solution", href: "#solution" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Analytics", href: "#analytics" },
  { label: "Safety", href: "#safety" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <nav
          aria-label="Primary"
          className="flex items-center justify-between gap-2 rounded-full border border-white/10 bg-[#050C16]/70 py-2.5 pl-4 pr-2.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl"
        >
          <a
            href="#top"
            className="flex shrink-0 items-center gap-2 text-white"
            aria-label="Chekie — back to top"
          >
            <Logo
              subtitle="DOrSU Counseling"
              subtitleClassName="text-blue-200/50 lg:hidden xl:block"
            />
          </a>

          <div className="hidden shrink-0 items-center lg:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-semibold text-blue-100/65 transition-colors hover:bg-white/[0.06] hover:text-white xl:px-3 xl:text-sm"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <a
              href="/login"
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-blue-100/80 transition-colors hover:text-white"
            >
              Login
            </a>
            <a
              href="#cta"
              className="inline-flex h-9 items-center justify-center rounded-full bg-yellow-400 px-5 text-[13px] font-bold text-ink shadow-[0_14px_30px_-14px_rgba(245,158,11,0.85)] transition hover:-translate-y-0.5 hover:bg-yellow-300"
            >
              Book a Session
            </a>
          </div>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:bg-white/[0.1] lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-2 rounded-3xl border border-white/10 bg-[#07101D]/95 p-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:hidden"
            >
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-[15px] font-semibold text-blue-100/70 hover:bg-white/[0.06] hover:text-white"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 p-1">
                <a
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white"
                >
                  Login
                </a>
                <a
                  href="#cta"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-ink"
                >
                  Book a Session
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
