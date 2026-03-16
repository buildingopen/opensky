import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except API routes, static files, and Next.js internals
    "/((?!api|_next|favicon\\.ico|favicon\\.svg|apple-touch-icon\\.png|site\\.webmanifest|robots\\.txt|sitemap\\.xml|countries-110m\\.json|llms\\.txt|.*\\..*).*)",
  ],
};
