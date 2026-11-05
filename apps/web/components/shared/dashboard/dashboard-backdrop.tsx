/**
 * Ambient background for the Guidance Head dashboard canvas.
 *
 * Same visual language as the landing page (`LandingBackdrop`): deep navy,
 * a cool blue wash, a soft yellow glow, a dotted texture, and a single
 * diagonal beam. Unlike the landing version this is `absolute`, not `fixed`,
 * so it stays inside the dashboard card and never covers the staff sidebar.
 */
export function DashboardBackdrop() {
  return (
    <div aria-hidden data-dashboard-backdrop className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050C16]">
      <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_80%_10%,rgba(37,99,235,0.18),transparent_55%)]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 20%, black 15%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 20%, black 15%, transparent 75%)",
        }}
      />
      <div className="absolute -top-56 right-[-10%] h-[560px] w-[560px] rounded-full bg-blue-500/15 blur-[160px]" />
      <div className="absolute bottom-[-25%] left-[-15%] h-[480px] w-[480px] rounded-full bg-yellow-400/[0.07] blur-[160px]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="head-dashboard-beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0" />
            <stop offset="35%" stopColor="#FBBF24" stopOpacity="0.18" />
            <stop offset="70%" stopColor="#60A5FA" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-110 820 C 320 720, 660 520, 1560 180"
          stroke="url(#head-dashboard-beam)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
