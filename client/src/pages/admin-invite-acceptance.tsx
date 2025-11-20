import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AdminInvitationDetails {
  email: string;
  organizationName: string;
  organizationId: string;
  logoUrl?: string;
  expiresAt: string;
  status: string;
}

export default function AdminInviteAcceptance() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    data: invitation,
    isLoading: invitationLoading,
    error: invitationError,
  } = useQuery<AdminInvitationDetails>({
    queryKey: ["/api/admin-invitations", token],
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin-invitations/${token}/accept`, {});
    },
    onSuccess: () => {
      toast({
        title: "Invitation accepted!",
        description: "You are now an administrator for this organization.",
      });
      setLocation(`/org/${invitation?.organizationId}/tournaments`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error accepting invitation",
        description: error.message || "Failed to accept invitation. Please try again.",
      });
    },
  });

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

  const isExpired = new Date() > new Date(invitation.expiresAt);
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              <CardTitle className="text-orange-600">Invitation Expired</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4" data-testid="text-expired-message">
              This invitation expired on {new Date(invitation.expiresAt).toLocaleDateString()}.
              Please contact the organization administrator for a new invitation.
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-green-600" />
              <div>
                <CardTitle>Admin Invitation</CardTitle>
                <CardDescription>
                  {invitation.organizationName}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitation.logoUrl && (
              <div className="flex justify-center py-4">
                <img
                  src={invitation.logoUrl}
                  alt={`${invitation.organizationName} logo`}
                  className="h-20 object-contain"
                  data-testid="img-org-logo"
                />
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4" data-testid="card-invitation-details">
              <p className="text-sm text-gray-600 mb-2">You've been invited to become an administrator for:</p>
              <p className="font-semibold text-lg text-gray-900">{invitation.organizationName}</p>
              <p className="text-sm text-gray-500 mt-2">
                Invited email: <span className="font-medium">{invitation.email}</span>
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <strong>Please log in to accept this invitation.</strong>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                This invitation expires on {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
            </div>

            <a href="/api/login" className="block">
              <Button
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="button-login"
              >
                <Shield className="w-5 h-5 mr-2" />
                Log In with Replit
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-green-600" />
            <div>
              <CardTitle>Admin Invitation</CardTitle>
              <CardDescription>
                {invitation.organizationName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitation.logoUrl && (
            <div className="flex justify-center py-4">
              <img
                src={invitation.logoUrl}
                alt={`${invitation.organizationName} logo`}
                className="h-20 object-contain"
                data-testid="img-org-logo"
              />
            </div>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4" data-testid="card-invitation-details">
            <p className="text-sm text-gray-600 mb-2">You've been invited to become an administrator for:</p>
            <p className="font-semibold text-lg text-gray-900">{invitation.organizationName}</p>
            <p className="text-sm text-gray-500 mt-2">
              Invited email: <span className="font-medium">{invitation.email}</span>
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900 mb-2">As an admin, you will be able to:</p>
            <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
              <li>Create and manage tournaments</li>
              <li>Manage teams and rosters</li>
              <li>Configure organization settings</li>
              <li>Invite other administrators</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="flex-1"
              data-testid="button-accept-invitation"
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              disabled={acceptMutation.isPending}
              data-testid="button-decline"
            >
              Decline
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            This invitation expires on {new Date(invitation.expiresAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
