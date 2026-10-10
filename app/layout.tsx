import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cortex — AI Company Brain",
  description: "Multi-agent system with FalkorDB as the context layer. Ask anything about your company's people, projects, and decisions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased">
        {children}
      </body>
    </html>
  );
}
