import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useHostnameContext } from "@/hooks/useHostnameContext";
import Home from "@/pages/home";
import OrganizationPage from "@/pages/organization";
import Dashboard from "@/pages/dashboard";
import CoachScoreInput from "@/pages/coach-score-input";
import AdminPortal from "@/pages/admin-portal";
import TournamentDashboard from "@/pages/tournament-dashboard";
import ValidationReport from "@/pages/validation-report";
import PublicDirectory from "@/pages/public-directory";
import TournamentRegistrationComingSoon from "@/pages/coming-soon/tournament-registration";
import TournamentCommsComingSoon from "@/pages/coming-soon/tournament-comms";
import ScheduleBuilderComingSoon from "@/pages/coming-soon/schedule-builder";
import BookingDashboard from "@/pages/booking/booking-dashboard";
import NewBookingRequest from "@/pages/booking/new-booking-request";
import BookingRequestDetail from "@/pages/booking/booking-request-detail";
import { BookingCalendarPage } from "@/pages/booking/booking-calendar-page";
import { AdminBookingCalendarPage } from "@/pages/booking/admin-booking-calendar-page";
import CoordinatorApprovals from "@/pages/booking/coordinator-approvals";
import TeamManagementPage from "@/pages/booking/team-management-page";
import BookingReportsPage from "@/pages/booking/booking-reports-page";
import BookingSettingsPage from "@/pages/booking/booking-settings-page";
import InviteAcceptance from "@/pages/invite-acceptance";
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

function HostnameAwareHome() {
  const { isStorefront, isLoading } = useHostnameContext();

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

  return isStorefront ? <PublicDirectory /> : <Home />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes - always accessible */}
      <Route path="/" component={HostnameAwareHome} />
      <Route path="/directory" component={PublicDirectory} />
      <Route path="/org/:slug" component={OrganizationPage} />
      <Route path="/dashboard/:tournamentId" component={Dashboard} />
      <Route path="/tournament/:tournamentId" component={TournamentDashboard} />
      <Route path="/coach-score-input/:tournamentId" component={CoachScoreInput} />
      
      {/* Invitation acceptance - public route */}
      <Route path="/invite/:token" component={InviteAcceptance} />
      
      {/* Coming Soon pages */}
      <Route path="/coming-soon/tournament-registration" component={TournamentRegistrationComingSoon} />
      <Route path="/coming-soon/tournament-comms" component={TournamentCommsComingSoon} />
      <Route path="/coming-soon/schedule-builder" component={ScheduleBuilderComingSoon} />
      
      {/* Booking module routes - protected (specific routes first) */}
      <Route path="/booking/:orgId/calendar">
        {() => <RequireAuth component={BookingCalendarPage} />}
      </Route>
      <Route path="/booking/:orgId/new-request">
        {() => <RequireAuth component={NewBookingRequest} />}
      </Route>
      <Route path="/booking/:orgId/request/:requestId">
        {() => <RequireAuth component={BookingRequestDetail} />}
      </Route>
      <Route path="/booking/:orgId/approvals">
        {() => <RequireAuth component={CoordinatorApprovals} />}
      </Route>
      <Route path="/booking/:orgId/teams">
        {() => <RequireAuth component={TeamManagementPage} />}
      </Route>
      <Route path="/booking/:orgId/reports">
        {() => <RequireAuth component={BookingReportsPage} />}
      </Route>
      <Route path="/booking/:orgId/settings">
        {() => <RequireAuth component={BookingSettingsPage} />}
      </Route>
      <Route path="/booking/:orgId">
        {() => <RequireAuth component={BookingDashboard} />}
      </Route>
      
      {/* Protected admin routes */}
      <Route path="/admin-portal/:tournamentId?">
        {() => <RequireAuth component={AdminPortal} />}
      </Route>
      <Route path="/admin/:tournamentId?">
        {() => <RequireAuth component={AdminPortal} />}
      </Route>
      <Route path="/admin/booking/calendar">
        {() => <RequireAuth component={AdminBookingCalendarPage} />}
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
