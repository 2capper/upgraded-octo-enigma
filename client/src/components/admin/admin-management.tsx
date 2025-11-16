import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, UserMinus, Mail, Send, Loader2, Shield, Users, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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

export function AdminManagement({ organizationId }: AdminManagementProps) {
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

        {/* Remove Admin Confirmation Dialog */}
        <Dialog open={!!adminToRemove} onOpenChange={(open) => !open && setAdminToRemove(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Admin</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this administrator? They will lose access to manage this organization.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdminToRemove(null)}
                disabled={removeAdminMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveAdmin}
                disabled={removeAdminMutation.isPending}
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
      </CardContent>
    </Card>
  );
}
