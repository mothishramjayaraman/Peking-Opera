import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers.js";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "京剧 AI 教练 - Peking Opera AI Vocal Coach",
  description: "Master the art of Peking Opera (京剧) with AI-powered coaching. Train 旦角, 生角, and 净角 voice roles with real-time feedback, 行腔 analysis, and classic 唱段 from 霸王别姬 to 锁麟囊.",
  openGraph: {
    title: "京剧 AI 教练 - Your Personal Jingju Vocal Coach",
    description: "Transform your Peking Opera singing with AI-powered acoustic analysis, 咬字 training, personalized 唱腔 exercises, and virtual 京剧大戏院 performance practice.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
