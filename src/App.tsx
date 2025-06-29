import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import { Web3Provider } from "./providers/Web3Provider";

// Lazy load pages for better performance
const Index = React.lazy(() => import("./pages/EnhancedIndex"));
const BreathingSession = React.lazy(() => import("./pages/BreathingSession"));
const Results = React.lazy(() => import("./pages/Results"));
const Progress = React.lazy(() => import("./pages/Progress"));
const Auth = React.lazy(() => import("./pages/Auth"));
const DiagnosticPage = React.lazy(() => import("./pages/DiagnosticPage"));
const AISettings = React.lazy(() => import("./pages/AISettings"));
const Marketplace = React.lazy(() => import("./pages/EnhancedMarketplace"));
const CreatorDashboard = React.lazy(() => import("./pages/CreatorDashboard"));
const CreatePattern = React.lazy(() => import("./pages/CreatePattern"));
const InstructorOnboarding = React.lazy(
  () => import("./pages/InstructorOnboarding")
);
const ProtectedRoute = React.lazy(() => import("./components/ProtectedRoute"));
const UserProfile = React.lazy(() => import("./pages/UserProfile"));
const CommunityFeed = React.lazy(() => import("./pages/CommunityFeed"));

const PageLoader = () => (
  <div className="flex-grow flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const App = () => (
  <Web3Provider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/session" element={<BreathingSession />} />
              <Route path="/results" element={<Results />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/diagnostic" element={<DiagnosticPage />} />
              <Route path="/ai-settings" element={<AISettings />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route element={<ProtectedRoute requiredRole="creator" />}>
                <Route
                  path="/creator-dashboard"
                  element={<CreatorDashboard />}
                />
                <Route path="/create-pattern" element={<CreatePattern />} />
              </Route>
              <Route
                path="/instructor-onboarding"
                element={<InstructorOnboarding />}
              />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/feed" element={<CommunityFeed />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </Web3Provider>
);

export default App;
