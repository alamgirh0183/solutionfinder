import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "SolutionFinder | Find the right tools for your problem",
    template: "%s | SolutionFinder",
  },
  description:
    "Describe a problem and discover relevant websites, apps, tools, and services that can help.",
  applicationName: "SolutionFinder",
  openGraph: {
    title: "SolutionFinder | Find the right tools for your problem",
    description:
      "Describe a problem and discover relevant websites, apps, tools, and services that can help.",
    siteName: "SolutionFinder",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SolutionFinder | Find the right tools for your problem",
    description:
      "Describe a problem and discover relevant websites, apps, tools, and services that can help.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

function getMetadataBase() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;
  try {
    return new URL(siteUrl);
  } catch {
    console.error("NEXT_PUBLIC_SITE_URL is not a valid URL for metadata.");
    return undefined;
  }
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
