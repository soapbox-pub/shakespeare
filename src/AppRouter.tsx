import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { SessionMonitor } from "./components/SessionMonitor";

import Index from "./pages/Index";
import Clone from "./pages/Clone";
import Settings from "./pages/Settings";
import Preferences from "./pages/Preferences";
import NostrSettings from "./pages/NostrSettings";
import AISettings from "./pages/AISettings";
import GitSettings from "./pages/GitSettings";
import DataSettings from "./pages/DataSettings";
import AboutSettings from "./pages/AboutSettings";
import EmailSettings from "./pages/EmailSettings";
import GitHubOAuth from "./pages/GitHubOAuth";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";
import { ProjectView } from "./pages/ProjectView";
import { SettingsLayout } from "./components/SettingsLayout";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <SessionMonitor />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/clone" element={<Clone />} />
        <Route path="/oauth/github" element={<GitHubOAuth />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Settings />} />
          <Route path="preferences" element={<Preferences />} />
          <Route path="nostr" element={<NostrSettings />} />
          <Route path="ai" element={<AISettings />} />
          <Route path="git" element={<GitSettings />} />
          <Route path="data" element={<DataSettings />} />
          <Route path="email" element={<EmailSettings />} />
          <Route path="about" element={<AboutSettings />} />
        </Route>
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
