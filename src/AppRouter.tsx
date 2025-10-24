/// <reference path="../electron/electron.d.ts" />

import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { SessionMonitor } from "./components/SessionMonitor";
import { URLFragmentHandler } from "./components/URLFragmentHandler";

import Index from "./pages/Index";
import Clone from "./pages/Clone";
import Settings from "./pages/Settings";
import Preferences from "./pages/Preferences";
import NostrSettings from "./pages/NostrSettings";
import AISettings from "./pages/AISettings";
import GitSettings from "./pages/GitSettings";
import DeploySettings from "./pages/DeploySettings";
import SystemSettings from "./pages/SystemSettings";
import StorageSettings from "./pages/StorageSettings";
import AboutSettings from "./pages/AboutSettings";

import GitHubOAuth from "./pages/GitHubOAuth";
import NetlifyOAuth from "./pages/NetlifyOAuth";
import VercelOAuth from "./pages/VercelOAuth";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";
import { ProjectView } from "./pages/ProjectView";
import { SettingsLayout } from "./components/SettingsLayout";

export function AppRouter() {
  // Use HashRouter in Electron, BrowserRouter in web
  const Router = window.electron?.isElectron ? HashRouter : BrowserRouter;

  return (
    <Router>
      <ScrollToTop />
      <SessionMonitor />
      <URLFragmentHandler />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/clone" element={<Clone />} />
        <Route path="/oauth/github" element={<GitHubOAuth />} />
        <Route path="/oauth/netlify" element={<NetlifyOAuth />} />
        <Route path="/oauth/vercel" element={<VercelOAuth />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Settings />} />
          <Route path="preferences" element={<Preferences />} />
          <Route path="nostr" element={<NostrSettings />} />
          <Route path="ai" element={<AISettings />} />
          <Route path="git" element={<GitSettings />} />
          <Route path="deploy" element={<DeploySettings />} />
          <Route path="system" element={<SystemSettings />} />
          <Route path="storage" element={<StorageSettings />} />
          <Route path="about" element={<AboutSettings />} />
        </Route>
        <Route path="/project/:projectId" element={<ProjectView />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
export default AppRouter;
