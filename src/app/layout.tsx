// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ACCROM Admin",
  description: "Panel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={cn("min-h-dvh bg-background text-foreground antialiased ")}>
        {children}
      </body>
    </html>
  );
}

