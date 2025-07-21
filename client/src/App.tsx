import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import CoachScoreInput from "@/pages/coach-score-input";
import AdminPortal from "@/pages/admin-portal";
import TournamentDashboard from "@/pages/tournament-dashboard";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function RedirectToAdminPortal() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation("/admin-portal");
  }, [setLocation]);
  
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RedirectToAdminPortal} />
      <Route path="/dashboard/:tournamentId" component={Dashboard} />
      <Route path="/tournament/:tournamentId" component={TournamentDashboard} />
      <Route path="/coach-score-input/:tournamentId" component={CoachScoreInput} />
      <Route path="/admin-portal/:tournamentId?" component={AdminPortal} />
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
