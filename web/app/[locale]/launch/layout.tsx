import type { Metadata } from "next";

const OG_IMAGE = "https://api.flyfast.app/static/launch-poster.jpg";

export const metadata: Metadata = {
  title: "FlyFast is live — Search flights like you'd text a friend.",
  description: "\"Somewhere warm from Berlin, under 300\" — just type it. No forms, no login, open source.",
  openGraph: {
    title: "FlyFast is live",
    description: "\"Somewhere warm from Berlin, under 300\" — just type it. Every airline searched.",
    url: "https://flyfast.app/launch",
    type: "video.other",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "FlyFast — Search flights like you'd text a friend." }],
    videos: [{ url: "https://api.flyfast.app/static/launch-video-web.mp4", width: 1920, height: 1080, type: "video/mp4" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlyFast is live",
    description: "\"Somewhere warm from Berlin, under 300\" — just type it. Every airline searched.",
    images: [OG_IMAGE],
  },
};

export default function LaunchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="dns-prefetch" href="https://api.flyfast.app" />
      <link rel="preconnect" href="https://api.flyfast.app" crossOrigin="anonymous" />
      <style>{`
        header, footer, .cloud-orb { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
