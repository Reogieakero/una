import { Suspense } from "react";
import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { Solution } from "@/components/sections/Solution";
import { KeyFeatures } from "@/components/sections/KeyFeatures";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Roles } from "@/components/sections/Roles";
import { Analytics } from "@/components/sections/Analytics";
import { Safety } from "@/components/sections/Safety";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Journey } from "@/components/journey/Journey";
import { AuthMessageToast } from "@/components/shared/auth-message-toast";

export default function Page() {
  return (
    <>
      <Suspense>
        <AuthMessageToast />
      </Suspense>
      <Navbar />
      {/* Vertical page: mobile, touch, and reduced-motion users */}
      <div className="vertical-only">
        <main id="main">
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
      {/* Horizontal journey: desktop, Keeby-style */}
      <div className="journey-only">
        <Journey />
      </div>
    </>
  );
}
