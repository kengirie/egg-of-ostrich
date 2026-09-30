import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { getNestSiteTarget, isAnswerSlug } from "@/lib/siteConfig";

import AnswerPage from "./pages/AnswerPage";
import Index from "./pages/Index";
import NestPage from "./pages/NestPage";
import NewNestPage from "./pages/NewNestPage";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

/**
 * On a nest's own nsite the nest is served at "/", so boot straight into it
 * (same trick as Rostrum's deck sites). On normal app hosts this is the home.
 */
export function RootRoute() {
  const target = getNestSiteTarget();
  return target ? <NestPage npub={target.npub} nestId={target.nestId} /> : <Index />;
}

/**
 * `/a/<slug>.html` — a baked answer page on a nest's nsite (the link in the
 * kind 1 answer note). Only meaningful on a nest site; elsewhere it is a 404.
 */
export function AnswerFileRoute() {
  const { answerFile = "" } = useParams<{ answerFile: string }>();
  const target = getNestSiteTarget();
  const slug = answerFile.replace(/\.html$/, "");
  if (!target || !answerFile.endsWith(".html") || !isAnswerSlug(slug)) return <NotFound />;
  return <AnswerPage npub={target.npub} nestId={target.nestId} slug={slug} />;
}

export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRoute />} />
        {/* App home, reachable on every host — including a nest site whose "/" is the nest. */}
        <Route path="/home" element={<Index />} />
        <Route path="/new" element={<NewNestPage />} />
        {/* Answer page on a nest site: /a/<slug>.html (must stay above /:npub/:nestId) */}
        <Route path="/a/:answerFile" element={<AnswerFileRoute />} />
        {/* Answer page in the app: /<npub>/<nest-id>/a/<slug> */}
        <Route path="/:npub/:nestId/a/:slug" element={<AnswerPage />} />
        {/* Nest: /<npub>/<nest-id> */}
        <Route path="/:npub/:nestId" element={<NestPage />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
