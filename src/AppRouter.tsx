import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { getSiteTarget } from "@/lib/siteConfig";

import AnswerPage from "./pages/AnswerPage";
import Index from "./pages/Index";
import NestPage from "./pages/NestPage";
import NewNestPage from "./pages/NewNestPage";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

/**
 * On a nest or answer nsite the page is served at "/", so boot straight into
 * it (same trick as Rostrum's deck sites). On normal app hosts this is the home.
 */
export function RootRoute() {
  const target = getSiteTarget();
  if (target?.kind === "nest") return <NestPage npub={target.npub} />;
  if (target?.kind === "answer") return <AnswerPage npub={target.npub} eggId={target.eggId} />;
  return <Index />;
}

export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRoute />} />
        {/* App home, reachable on every host — including nest/answer sites whose "/" is taken. */}
        <Route path="/home" element={<Index />} />
        {/* Open or edit your question box */}
        <Route path="/new" element={<NewNestPage />} />
        {/* Answer in the app: /<npub>/q<12 hex> */}
        <Route path="/:npub/:answerId" element={<AnswerPage />} />
        {/* NIP-19 route: npub → that user's nest, naddr of a nest/answer site */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
