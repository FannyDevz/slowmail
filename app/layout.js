import { Figtree, Young_Serif } from "next/font/google";
import "./globals.css";

const youngSerif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Merpati Mail",
  description: "Email yang diantar merpati, elang, kucing, atau kura-kura. Pesan baru bisa dibuka setelah kurirnya mendarat.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${youngSerif.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
