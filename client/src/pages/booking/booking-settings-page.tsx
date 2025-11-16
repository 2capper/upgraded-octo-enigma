import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, UserPlus, UserMinus, Mail, Calendar as CalendarIcon, Send, Loader2, Shield, Users, X } from "lucide-react";
import { CalendarSubscription } from "@/components/booking/calendar-subscription";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface OrganizationAdmin {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  user?: User;
}

interface AdminInvitation {
  id: string;
  organizationId: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface AdminManagementProps {
  organizationId: string;
}

function AdminManagement({ organizationId }: AdminManagementProps) {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<OrganizationAdmin | null>(null);

  const { data: admins, isLoading: adminsLoading } = useQuery<OrganizationAdmin[]>({
    queryKey: ['/api/organizations', organizationId, 'admins'],
  });

  const { data: invitations, isLoading: invitationsLoading } = useQuery<AdminInvitation[]>({
    queryKey: ['/api/organizations', organizationId, 'admin-invitations'],
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('POST', `/api/organizations/${organizationId}/admin-invitations`, { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'admin-invitations'] });
      toast({
        title: "Invitation Sent",
        description: "Admin invitation has been sent successfully.",
      });
      setInviteEmail("");
      setIsInviteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Invitation Failed",
        description: error.message || "Failed to send invitation. Please try again.",
      });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest('DELETE', `/api/organizations/${organizationId}/admin-invitations/${invitationId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'admin-invitations'] });
      toast({
        title: "Invitation Revoked",
        description: "Admin invitation has been revoked successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Revoke Failed",
        description: "Failed to revoke invitation. Please try again.",
      });
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('DELETE', `/api/organizations/${organizationId}/admins/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'admins'] });
      toast({
        title: "Admin Removed",
        description: "Admin has been removed successfully.",
      });
      setAdminToRemove(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Removal Failed",
        description: error.message || "Failed to remove admin. Please try again.",
      });
    },
  });

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter an email address.",
      });
      return;
    }
    inviteMutation.mutate(inviteEmail.trim());
  };

  const handleRemoveAdmin = () => {
    if (adminToRemove) {
      removeAdminMutation.mutate(adminToRemove.userId);
    }
  };

  const pendingInvitations = invitations?.filter(inv => inv.status === 'pending') || [];

  return (
    <Card data-testid="card-admin-management">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Admin Management
        </CardTitle>
        <CardDescription>
          Manage organization administrators and invitations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Admins List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Current Admins ({admins?.length || 0})
            </h3>
          </div>

          {adminsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" data-testid="loader-admins" />
            </div>
          ) : admins && admins.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id} data-testid={`row-admin-${admin.userId}`}>
                    <TableCell className="font-medium">
                      {admin.user?.firstName && admin.user?.lastName
                        ? `${admin.user.firstName} ${admin.user.lastName}`
                        : admin.user?.email || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {admin.user?.email || 'No email'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAdminToRemove(admin)}
                        disabled={(admins.length <= 1) || removeAdminMutation.isPending}
                        data-testid={`button-remove-admin-${admin.userId}`}
                      >
                        <UserMinus className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No admins found</p>
          )}
        </div>

        {/* Pending Invitations */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Pending Invitations ({pendingInvitations.length})
          </h3>

          {invitationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" data-testid="loader-invitations" />
            </div>
          ) : pendingInvitations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id} data-testid={`row-invitation-${invitation.id}`}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-testid={`badge-status-${invitation.id}`}>
                        {invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(invitation.expiresAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                        disabled={revokeInvitationMutation.isPending}
                        data-testid={`button-revoke-${invitation.id}`}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No pending invitations</p>
          )}
        </div>

        {/* Invite New Admin */}
        <div className="pt-4 border-t">
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" data-testid="button-invite-admin">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite New Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Admin</DialogTitle>
                <DialogDescription>
                  Send an invitation to add a new administrator to this organization.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    data-testid="input-invite-email"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteDialogOpen(false)}
                    disabled={inviteMutation.isPending}
                    data-testid="button-cancel-invite"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    data-testid="button-send-invite"
                  >
                    {inviteMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Invite
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>

      {/* Remove Admin Confirmation Dialog */}
      <Dialog open={!!adminToRemove} onOpenChange={(open) => !open && setAdminToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Admin</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this administrator? They will lose access to manage this organization.
            </DialogDescription>
          </DialogHeader>
          {adminToRemove && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {adminToRemove.user?.firstName && adminToRemove.user?.lastName
                      ? `${adminToRemove.user.firstName} ${adminToRemove.user.lastName}`
                      : adminToRemove.user?.email || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground">{adminToRemove.user?.email}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdminToRemove(null)}
              disabled={removeAdminMutation.isPending}
              data-testid="button-cancel-remove"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveAdmin}
              disabled={removeAdminMutation.isPending}
              data-testid="button-confirm-remove"
            >
              {removeAdminMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Admin'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function BookingSettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, setLocation] = useLocation();

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/${orgId}`],
  });

  const { data: userRole, isLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/user-role`],
  });

  const isAdmin = userRole?.isAdmin || false;

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      setLocation(`/booking/${orgId}`);
    }
  }, [isLoading, isAdmin, orgId, setLocation]);

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

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2B3A4A] text-white py-6 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <Link href={`/booking/${orgId}`}>
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10 mb-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{organization?.name || 'Loading...'}</h1>
          <p className="text-gray-300 mt-1">Settings</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        {organization && (
          <>
            <CalendarSubscription
              type="organization"
              entityId={organization.id}
              organizationId={orgId!}
              currentToken={organization.calendarSubscriptionToken}
              entityName={organization.name}
            />

            <AdminManagement organizationId={organization.id} />
          </>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Diamond Restrictions</CardTitle>
            <CardDescription>Configure which diamonds can be used by each division</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-center py-8">Diamond restrictions will appear here</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
