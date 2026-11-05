/**
 * Ambient background shared by the whole landing page. Mirrors the
 * AuthShell backdrop so the public landing and the login/register pages
 * read as one product: deep navy, a cool blue wash, a soft yellow glow,
 * a dotted texture, and a single diagonal light beam.
 */
export function LandingBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#050C16]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_80%_10%,rgba(37,99,235,0.18),transparent_55%)]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
        }}
      />
      <div className="absolute -top-56 right-[-10%] h-[640px] w-[640px] rounded-full bg-blue-500/15 blur-[160px]" />
      <div className="absolute bottom-[-30%] left-[-15%] h-[520px] w-[520px] rounded-full bg-yellow-400/[0.07] blur-[160px]" />
      <div className="absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-blue-600/[0.06] blur-[160px]" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="landing-beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0" />
            <stop offset="35%" stopColor="#FBBF24" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#60A5FA" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-110 800 C 320 690, 660 500, 1560 180"
          stroke="url(#landing-beam)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
