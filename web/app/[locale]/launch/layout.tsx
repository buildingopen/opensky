import type { Metadata } from "next";

const OG_IMAGE = "https://api.flyfast.app/static/launch-poster.jpg";

export const metadata: Metadata = {
  title: "FlyFast — Search flights in plain English",
  description: "One sentence instead of six form fields. Free, no login, open source.",
  openGraph: {
    title: "FlyFast — Search flights in plain English",
    description: "One sentence instead of six form fields. Free, no login, open source.",
    url: "https://flyfast.app/launch",
    type: "video.other",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "FlyFast launch video" }],
    videos: [{ url: "https://api.flyfast.app/static/launch-video-web.mp4", width: 1920, height: 1080, type: "video/mp4" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlyFast — Search flights in plain English",
    description: "One sentence instead of six form fields. Free, no login, open source.",
    images: [OG_IMAGE],
  },
};

export default function LaunchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
