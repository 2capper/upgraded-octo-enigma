import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Users, Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { HouseLeagueTeam } from "@shared/schema";

interface InvitationDetails {
  email: string;
  organizationName: string;
  organizationId: string;
  teamIds: string[];
  logoUrl?: string;
  expiresAt: string;
  status: string;
}

export default function InviteAcceptance() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();

  // Fetch invitation details (public route, no auth needed)
  const {
    data: invitation,
    isLoading: invitationLoading,
    error: invitationError,
  } = useQuery<InvitationDetails>({
    queryKey: ["/api/invitations", token],
    enabled: !!token,
  });

  // Fetch house league teams to resolve team names
  const {
    data: teams,
    isLoading: teamsLoading,
  } = useQuery<HouseLeagueTeam[]>({
    queryKey: ["/api/organizations", invitation?.organizationId, "house-league-teams"],
    enabled: !!invitation?.organizationId && isAuthenticated,
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/invitations/${token}/accept`, {});
    },
    onSuccess: () => {
      toast({
        title: "Invitation accepted!",
        description: "You now have access to the organization.",
      });
      setLocation(`/org/${invitation?.organizationId}/admin`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error accepting invitation",
        description: error.message || "Failed to accept invitation. Please try again.",
      });
    },
  });

  // Loading state while checking auth
  if (authLoading || invitationLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" data-testid="loader-invitation" />
              <p className="text-gray-600">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error states
  if (invitationError || !invitation) {
    const errorMessage = invitationError
      ? (invitationError as any).message || "Invalid invitation link"
      : "Invalid invitation link";
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <CardTitle className="text-red-600">Invitation Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4" data-testid="text-error-message">
              {errorMessage.includes("expired")
                ? "This invitation has expired"
                : errorMessage.includes("already been accepted")
                ? "This invitation has already been accepted"
                : errorMessage.includes("revoked")
                ? "This invitation has been revoked"
                : "Invalid invitation link"}
            </p>
            <Button
              onClick={() => setLocation("/")}
              className="w-full"
              data-testid="button-return-home"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if invitation is expired
  const isExpired = new Date() > new Date(invitation.expiresAt);
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <CardTitle className="text-red-600">Invitation Expired</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4" data-testid="text-expired-message">
              This invitation has expired. Please contact your organization administrator for a new invitation.
            </p>
            <Button
              onClick={() => setLocation("/")}
              className="w-full"
              data-testid="button-return-home-expired"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if invitation status is not pending
  if (invitation.status !== "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <CardTitle className="text-red-600">Invitation {invitation.status}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4" data-testid="text-status-message">
              {invitation.status === "accepted"
                ? "This invitation has already been accepted"
                : "This invitation has been revoked"}
            </p>
            <Button
              onClick={() => setLocation("/")}
              className="w-full"
              data-testid="button-return-home-status"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex flex-col items-center">
              {invitation.logoUrl && (
                <img
                  src={invitation.logoUrl}
                  alt={invitation.organizationName}
                  className="w-20 h-20 object-contain mb-4"
                  data-testid="img-organization-logo"
                />
              )}
              <CardTitle className="text-center">Coach Invitation</CardTitle>
              <CardDescription className="text-center mt-2">
                You've been invited to {invitation.organizationName}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Email:</strong> {invitation.email}
                </p>
              </div>
              
              <p className="text-gray-600 text-sm text-center">
                Please sign in to accept this invitation and access the booking calendar.
              </p>

              <a href="/login" className="block">
                <Button
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-testid="button-sign-in"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Sign In
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Resolve team names from teamIds
  const invitedTeams = teams?.filter((team) => invitation.teamIds.includes(team.id)) || [];

  // Show acceptance form for authenticated users
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center">
            {invitation.logoUrl && (
              <img
                src={invitation.logoUrl}
                alt={invitation.organizationName}
                className="w-20 h-20 object-contain mb-4"
                data-testid="img-org-logo-authenticated"
              />
            )}
            <CardTitle className="text-center">Welcome to {invitation.organizationName}</CardTitle>
            <CardDescription className="text-center mt-2">
              You've been invited as a coach
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Invited Email:</strong> {invitation.email}
              </p>
              {user?.email && (
                <p className="text-sm text-green-800 mt-1">
                  <strong>Signed in as:</strong> {user.email}
                </p>
              )}
            </div>

            {teamsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 text-green-600 animate-spin" data-testid="loader-teams" />
                <span className="ml-2 text-gray-600">Loading teams...</span>
              </div>
            ) : invitedTeams.length > 0 ? (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">Your Teams</h3>
                </div>
                <ul className="space-y-2">
                  {invitedTeams.map((team) => (
                    <li
                      key={team.id}
                      className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded"
                      data-testid={`team-item-${team.id}`}
                    >
                      {team.name} {team.division && `(${team.division})`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">No teams assigned yet.</p>
              </div>
            )}

            <Button
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              data-testid="button-accept-invitation"
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              By accepting, you'll gain access to the booking calendar and can manage your team's practice times.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
