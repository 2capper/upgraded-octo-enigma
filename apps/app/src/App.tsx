import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import OrganizationPage from "@/pages/organization";
import Dashboard from "@/pages/dashboard";
import CoachScoreInput from "@/pages/coach-score-input";
import AdminPortal from "@/pages/admin-portal";
import TournamentDashboard from "@/pages/tournament-dashboard";
import ValidationReport from "@/pages/validation-report";
import TournamentRegistrationComingSoon from "@/pages/coming-soon/tournament-registration";
import TournamentCommsComingSoon from "@/pages/coming-soon/tournament-comms";
import ScheduleBuilderComingSoon from "@/pages/coming-soon/schedule-builder";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function RequireAuth({ component: Component }: { component: any }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes - always accessible */}
      <Route path="/" component={Home} />
      <Route path="/org/:slug" component={OrganizationPage} />
      <Route path="/dashboard/:tournamentId" component={Dashboard} />
      <Route path="/tournament/:tournamentId" component={TournamentDashboard} />
      <Route path="/coach-score-input/:tournamentId" component={CoachScoreInput} />
      
      {/* Coming Soon pages */}
      <Route path="/coming-soon/tournament-registration" component={TournamentRegistrationComingSoon} />
      <Route path="/coming-soon/tournament-comms" component={TournamentCommsComingSoon} />
      <Route path="/coming-soon/schedule-builder" component={ScheduleBuilderComingSoon} />
      
      {/* Protected admin routes */}
      <Route path="/admin-portal/:tournamentId?">
        {() => <RequireAuth component={AdminPortal} />}
      </Route>
      <Route path="/admin/:tournamentId?">
        {() => <RequireAuth component={AdminPortal} />}
      </Route>
      <Route path="/admin/:tournamentId/validation-report">
        {() => <RequireAuth component={ValidationReport} />}
      </Route>
      
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
