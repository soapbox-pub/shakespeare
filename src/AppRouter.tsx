import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { SessionMonitor } from "./components/SessionMonitor";

import Index from "./pages/Index";
import Clone from "./pages/Clone";
import Settings from "./pages/Settings";
import AISettings from "./pages/AISettings";
import GitSettings from "./pages/GitSettings";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";
import { ProjectView } from "./pages/ProjectView";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <SessionMonitor />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/clone" element={<Clone />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/ai" element={<AISettings />} />
        <Route path="/settings/git" element={<GitSettings />} />
        <Route path="/project/:projectId" element={<ProjectView />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
