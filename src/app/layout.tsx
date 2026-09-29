import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "YSABAL | Control avícola",
  description: "Control de campañas, mortalidad, pesos y ventas avícolas.",
  icons: {
    icon: "/favicon.svg",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
