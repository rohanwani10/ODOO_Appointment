import type { Metadata } from "next";
import { HomePageClient } from "@/components/landing/home-page-client";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const canonicalUrl = new URL("/", siteUrl).toString();
const pageTitle = "Calvero | Premium booking software for teams";
const pageDescription =
  "Calvero helps teams publish polished booking pages, sync Google Calendar, and convert real availability into confirmed meetings.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: canonicalUrl,
    siteName: "Calvero",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Calvero",
      url: canonicalUrl,
      description: pageDescription,
    },
    {
      "@type": "SoftwareApplication",
      name: "Calvero",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: canonicalUrl,
      description: pageDescription,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomePageClient />
    </>
  );
}
