import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Poppins, Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/query-provider";
import { RoutePendingProvider } from "@/components/shared/route-pending";
import { RealtimeProvider } from "@/components/shared/realtime-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chekie",
  description:
    "Chekie is Davao Oriental State University's safe, calm counseling companion: online booking, PSS-10 check-ins, secure anonymity, real-time chat, and analytics for early intervention.",
  icons: {
    icon: "/images/favicon.png",
    apple: "/images/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={cn(
          poppins.variable,
          nunito.variable,
          "min-h-screen bg-cream font-body text-ink"
        )}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {/* Single instance for the whole app — survives route-group changes
            ((admin)/(staff)/(counselor) layouts remount), so pending state and
            the overlay never flicker mid-navigation. */}
        <QueryProvider>
          {/* One realtime channel per session lives here — bell counts,
              toasts, and inbox patches for every page, no per-page channels. */}
          <RealtimeProvider>
            <RoutePendingProvider>{children}</RoutePendingProvider>
          </RealtimeProvider>
        </QueryProvider>
        {/* App-wide toasts — top-right, 2s auto-dismiss, closable (see globals.css). */}
        <Toaster position="top-right" duration={2000} closeButton gap={8} />
      </body>
    </html>
  );
}
