"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          className="flex items-center justify-between gap-2 rounded-full border border-white/70 bg-white/75 py-2.5 pl-4 pr-2.5 shadow-card backdrop-blur-xl"
        >
          <a href="#top" className="flex shrink-0 items-center gap-2" aria-label="Chekie — back to top">
            <Logo subtitle="DOrSU Counseling" subtitleClassName="lg:hidden xl:block" />
          </a>

          <div className="hidden shrink-0 items-center lg:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                 className="whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-blue-50 hover:text-ink xl:px-3 xl:text-sm"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <a href="/login">
              <Button variant="secondary" size="sm">
                Login
              </Button>
            </a>
            <a href="#cta">
              <Button size="sm">Book a Session</Button>
            </a>
          </div>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-white lg:hidden"
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
              className="mt-2 rounded-3xl border border-white/60 bg-white/95 p-3 shadow-soft backdrop-blur-xl lg:hidden"
            >
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-[15px] font-semibold text-ink-soft hover:bg-blue-50"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 p-1">
                <a href="/login" onClick={() => setOpen(false)}>
                  <Button variant="secondary" size="sm" className="w-full">
                    Login
                  </Button>
                </a>
                <a href="#cta" onClick={() => setOpen(false)}>
                  <Button size="sm" className="w-full">
                    Book a Session
                  </Button>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
