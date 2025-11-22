import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { useHostnameContext } from "@/hooks/useHostnameContext";
import { useQuery } from "@tanstack/react-query";
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
import TwilioSettings from "@/pages/TwilioSettings";
import WeatherSettings from "@/pages/WeatherSettings";
import WeatherDashboard from "@/pages/WeatherDashboard";
import Communications from "@/pages/Communications";
import InviteAcceptance from "@/pages/invite-acceptance";
import AdminInviteAcceptance from "@/pages/admin-invite-acceptance";
import OrganizationSelector from "@/pages/organization-selector";
import { WelcomePage } from "@/pages/welcome";
import OnboardingCreateOrganization from "@/pages/onboarding-create-organization";
import OrgAdminPortal from "@/pages/OrgAdminPortal";
import OrgSettings from "@/pages/OrgSettings";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import NotFoundPage from "@/pages/error-pages/404";
import UnauthorizedPage from "@/pages/error-pages/401";
import ServerErrorPage from "@/pages/error-pages/500";
import { useEffect } from "react";

function RequireAuth({ component: Component }: { component: any }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Fetch user data for super admin check
  const { data: userData, isLoading: isUserLoading } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    enabled: isAuthenticated,
  });

  // Fetch user's organizations to determine if they need onboarding
  const { data: userOrgs, isLoading: isOrgsLoading } = useQuery<Array<any>>({
    queryKey: ['/api/users/me/organizations'],
    enabled: isAuthenticated && !!user,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, location, setLocation]);

  // Hard redirect logic for new user onboarding
  useEffect(() => {
    if (isAuthenticated && !isOrgsLoading && !isUserLoading && userOrgs && userData) {
      // Skip onboarding redirects for super admins
      if (userData.isSuperAdmin) {
        return;
      }

      // Whitelist routes that new users (0 orgs) can access during onboarding
      const onboardingAllowedRoutes = ['/welcome', '/onboarding'];
      const isOnOnboardingRoute = onboardingAllowedRoutes.some(route => location.startsWith(route));
      
      // New user with no orgs - redirect to /welcome (unless on allowed onboarding route)
      if (userOrgs.length === 0 && !isOnOnboardingRoute) {
        setLocation('/welcome');
      }
      
      // User with orgs on /welcome page - redirect to home
      if (userOrgs.length > 0 && location === '/welcome') {
        setLocation('/');
      }
    }
  }, [isAuthenticated, isOrgsLoading, isUserLoading, userOrgs, userData, location, setLocation]);

  if (isLoading || isOrgsLoading || isUserLoading) {
    const message = isUserLoading 
      ? "Verifying your identity..." 
      : isOrgsLoading 
      ? "Setting up your workspace..." 
      : "Loading...";
    
    return <LoadingScreen message={message} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function HostnameAwareHome() {
  const { isStorefront, isLoading: hostnameLoading } = useHostnameContext();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Fetch user data for authenticated users
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    enabled: isAuthenticated,
  });

  // Fetch user's organizations for authenticated users
  const { data: userOrgs, isLoading: orgsLoading } = useQuery<Array<any>>({
    queryKey: ['/api/users/me/organizations'],
    enabled: isAuthenticated,
  });

  // Hard redirect logic for authenticated users on homepage
  useEffect(() => {
    if (isAuthenticated && !userLoading && !orgsLoading && user && userOrgs) {
      if (user.isSuperAdmin) {
        // Super admin - redirect to org selector
        setLocation('/select-organization');
      } else if (userOrgs.length === 0) {
        // New user with no orgs - redirect to /welcome
        setLocation('/welcome');
      }
    }
  }, [isAuthenticated, userLoading, orgsLoading, user, userOrgs, setLocation]);

  if (hostnameLoading || (isAuthenticated && (userLoading || orgsLoading))) {
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
      
      {/* Invitation acceptance - public routes */}
      <Route path="/invite/:token" component={InviteAcceptance} />
      <Route path="/admin-invite/:token" component={AdminInviteAcceptance} />
      
      {/* Onboarding flow for new users without an organization */}
      <Route path="/welcome">
        {() => <RequireAuth component={WelcomePage} />}
      </Route>
      <Route path="/onboarding/create-organization">
        {() => <RequireAuth component={OnboardingCreateOrganization} />}
      </Route>
      
      {/* Organization selector - protected */}
      <Route path="/select-organization">
        {() => <RequireAuth component={OrganizationSelector} />}
      </Route>
      
      {/* Coming Soon pages */}
      <Route path="/coming-soon/tournament-registration" component={TournamentRegistrationComingSoon} />
      <Route path="/coming-soon/tournament-comms" component={TournamentCommsComingSoon} />
      <Route path="/coming-soon/schedule-builder" component={ScheduleBuilderComingSoon} />
      
      {/* Organization Admin Portal - NEW modular landing page */}
      <Route path="/org/:orgId/admin">
        {() => <RequireAuth component={OrgAdminPortal} />}
      </Route>
      
      {/* New modular feature routes */}
      <Route path="/org/:orgId/communications">
        {() => <RequireAuth component={Communications} />}
      </Route>
      <Route path="/org/:orgId/weather">
        {() => <RequireAuth component={WeatherDashboard} />}
      </Route>
      <Route path="/org/:orgId/teams">
        {() => <RequireAuth component={TeamManagementPage} />}
      </Route>
      <Route path="/org/:orgId/reports">
        {() => <RequireAuth component={BookingReportsPage} />}
      </Route>
      <Route path="/org/:orgId/settings">
        {() => <RequireAuth component={OrgSettings} />}
      </Route>
      <Route path="/org/:orgId/booking">
        {() => <RequireAuth component={BookingDashboard} />}
      </Route>
      
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
      <Route path="/booking/:orgId/twilio-settings">
        {() => <RequireAuth component={TwilioSettings} />}
      </Route>
      <Route path="/booking/:orgId/weather-settings">
        {() => <RequireAuth component={WeatherSettings} />}
      </Route>
      <Route path="/booking/:orgId/communications">
        {() => <RequireAuth component={Communications} />}
      </Route>
      <Route path="/booking/:orgId">
        {() => <RequireAuth component={BookingDashboard} />}
      </Route>
      
      {/* Protected admin routes - NEW org-scoped routes */}
      <Route path="/org/:orgId/tournaments/tournament/:tournamentId/weather">
        {() => <RequireAuth component={WeatherDashboard} />}
      </Route>
      <Route path="/org/:orgId/tournaments/tournament/:tournamentId/validation-report">
        {() => <RequireAuth component={ValidationReport} />}
      </Route>
      <Route path="/org/:orgId/tournaments/tournament/:tournamentId">
        {() => <RequireAuth component={AdminPortal} />}
      </Route>
      <Route path="/org/:orgId/tournaments">
        {() => <RequireAuth component={AdminPortal} />}
      </Route>
      
      {/* Legacy admin routes - kept for backward compatibility */}
      <Route path="/admin/org/:orgId/tournament/:tournamentId/weather">
        {() => <RequireAuth component={WeatherDashboard} />}
      </Route>
      <Route path="/admin/org/:orgId/tournament/:tournamentId/validation-report">
        {() => <RequireAuth component={ValidationReport} />}
      </Route>
      <Route path="/admin/org/:orgId/tournament/:tournamentId">
        {() => <RequireAuth component={AdminPortal} />}
      </Route>
      <Route path="/admin/org/:orgId/booking/calendar">
        {() => <RequireAuth component={AdminBookingCalendarPage} />}
      </Route>
      <Route path="/admin/org/:orgId">
        {() => <RequireAuth component={AdminPortal} />}
      </Route>
      
      {/* Legacy admin routes - kept for backward compatibility, will redirect */}
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
      
      {/* Error Pages */}
      <Route path="/login" component={LoginPage} />
      <Route path="/401" component={UnauthorizedPage} />
      <Route path="/500" component={ServerErrorPage} />
      <Route path="/404" component={NotFoundPage} />
      
      <Route component={NotFoundPage} />
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
