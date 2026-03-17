"use client";

import { useEffect, useState } from "react";

const GA_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim();
const POSTHOG_KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY || "").trim();

const STORAGE_KEY = "flyfast_consent";
const EVENT_NAME = "flyfast_consent_change";

export function AnalyticsProvider() {
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    setConsent(localStorage.getItem(STORAGE_KEY));

    const onConsentChange = () => {
      setConsent(localStorage.getItem(STORAGE_KEY));
    };
    window.addEventListener(EVENT_NAME, onConsentChange);
    return () => window.removeEventListener(EVENT_NAME, onConsentChange);
  }, []);

  // Inject analytics scripts via DOM when consent is accepted
  // (Next.js <Script> with inline content doesn't execute when dynamically rendered)
  useEffect(() => {
    if (consent !== "accepted") return;

    if (GA_ID && !document.getElementById("ga-script")) {
      const gaExt = document.createElement("script");
      gaExt.id = "ga-script";
      gaExt.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      gaExt.async = true;
      document.head.appendChild(gaExt);

      const gaInit = document.createElement("script");
      gaInit.id = "ga-init";
      gaInit.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_ID}');
      `;
      document.head.appendChild(gaInit);
    }

    if (POSTHOG_KEY && !document.getElementById("posthog-script")) {
      const ph = document.createElement("script");
      ph.id = "posthog-script";
      ph.textContent = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${POSTHOG_KEY}',{api_host:'https://eu.i.posthog.com'});`;
      document.head.appendChild(ph);
    }
  }, [consent]);

  return null;
}
