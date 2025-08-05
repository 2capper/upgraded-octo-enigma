import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import CoachScoreInput from "@/pages/coach-score-input";
import AdminPortal from "@/pages/admin-portal";
import TournamentDashboard from "@/pages/tournament-dashboard";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

// Landing page for non-authenticated users
function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center p-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-green-800 mb-6">
          Forest Glade Falcons Tournament Management
        </h1>
        <p className="text-xl text-gray-700 mb-8">
          Comprehensive tournament management system for baseball teams
        </p>
        <div className="space-y-4">
          <a
            href="/api/login"
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition duration-200"
            data-testid="button-login"
          >
            Sign In with Replit
          </a>
          <p className="text-gray-600">
            Sign in to access tournament management features
          </p>
        </div>
      </div>
    </div>
  );
}

function RedirectToAdminPortal() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation("/admin-portal");
  }, [setLocation]);
  
  return null;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={RedirectToAdminPortal} />
          <Route path="/dashboard/:tournamentId" component={Dashboard} />
          <Route path="/tournament/:tournamentId" component={TournamentDashboard} />
          <Route path="/coach-score-input/:tournamentId" component={CoachScoreInput} />
          <Route path="/admin-portal/:tournamentId?" component={AdminPortal} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
