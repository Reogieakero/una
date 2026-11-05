import { Suspense } from "react";
import { Navbar } from "@/components/sections/Navbar";
import { LandingBackdrop } from "@/components/sections/LandingBackdrop";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { Solution } from "@/components/sections/Solution";
import { KeyFeatures } from "@/components/sections/KeyFeatures";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Roles } from "@/components/sections/Roles";
import { Analytics } from "@/components/sections/Analytics";
import { Safety } from "@/components/sections/Safety";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { AuthMessageToast } from "@/components/shared/auth-message-toast";

/**
 * Public landing page. Always a calm vertical scroll — the same dark,
 * glass-on-navy visual language as the login and register pages.
 */
export default function Page() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050C16] text-white">
      <LandingBackdrop />
      <Suspense>
        <AuthMessageToast />
      </Suspense>
      <Navbar />
      <main id="main" className="relative z-10">
        <Hero />
        <Problem />
        <Solution />
        <KeyFeatures />
        <HowItWorks />
        <Roles />
        <Analytics />
        <Safety />
        <FinalCTA />
      </main>
    </div>
  );
}
