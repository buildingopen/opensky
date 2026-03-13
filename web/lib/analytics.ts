type EventProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    posthog?: { capture: (event: string, properties?: EventProps) => void };
  }
}

export function trackEvent(event: string, properties: EventProps = {}) {
  if (typeof window === "undefined") return;

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, properties);
    }
    if (window.dataLayer) {
      window.dataLayer.push({ event, ...properties });
    }
    if (window.posthog?.capture) {
      window.posthog.capture(event, properties);
    }
  } catch {
    // Analytics should never break user journeys.
  }
}
