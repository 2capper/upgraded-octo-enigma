import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AccessDenied } from "@/components/AccessDenied";
import { 
  ArrowLeft, 
  Shield, 
  Users, 
  Search, 
  Loader2, 
  Building2,
  UserPlus,
  UserMinus,
  AlertTriangle
} from "lucide-react";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationAdmin {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
}

type ActionType = 'toggleAdmin' | 'toggleSuperAdmin' | 'assignOrg' | 'removeOrg';

interface PendingAction {
  type: ActionType;
  user: User;
  value?: boolean;
  organizationId?: string;
  organizationName?: string;
}

export default function UserManagement() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [selectedOrgForAssign, setSelectedOrgForAssign] = useState<string>("");

  // Fetch current user data to check super admin status
  const { data: currentUser, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: currentUser?.isSuperAdmin === true,
  });

  // Fetch all organizations
  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
    enabled: currentUser?.isSuperAdmin === true,
  });

  // Fetch all organization admins
  const { data: allOrgAdmins, isLoading: orgAdminsLoading } = useQuery<OrganizationAdmin[]>({
    queryKey: ['/api/all-organization-admins'],
    enabled: currentUser?.isSuperAdmin === true,
  });

  // Toggle admin status mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return apiRequest('PATCH', `/api/users/${userId}/admin-status`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Admin Status Updated",
        description: "User admin status has been updated successfully.",
      });
      setPendingAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update admin status.",
        variant: "destructive",
      });
    },
  });

  // Toggle super admin status mutation
  const toggleSuperAdminMutation = useMutation({
    mutationFn: async ({ userId, isSuperAdmin }: { userId: string; isSuperAdmin: boolean }) => {
      return apiRequest('PATCH', `/api/users/${userId}/super-admin-status`, { isSuperAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Super Admin Status Updated",
        description: "User super admin status has been updated successfully.",
      });
      setPendingAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update super admin status.",
        variant: "destructive",
      });
    },
  });

  // Assign organization admin mutation
  const assignOrgAdminMutation = useMutation({
    mutationFn: async ({ userId, organizationId }: { userId: string; organizationId: string }) => {
      return apiRequest('POST', `/api/organizations/${organizationId}/admins`, {
        userId,
        role: 'admin',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/all-organization-admins'] });
      toast({
        title: "Organization Admin Assigned",
        description: "User has been assigned as organization admin.",
      });
      setPendingAction(null);
      setSelectedOrgForAssign("");
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign organization admin.",
        variant: "destructive",
      });
    },
  });

  // Remove organization admin mutation
  const removeOrgAdminMutation = useMutation({
    mutationFn: async ({ userId, organizationId }: { userId: string; organizationId: string }) => {
      return apiRequest('DELETE', `/api/organizations/${organizationId}/admins/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/all-organization-admins'] });
      toast({
        title: "Organization Admin Removed",
        description: "User has been removed as organization admin.",
      });
      setPendingAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Removal Failed",
        description: error.message || "Failed to remove organization admin.",
        variant: "destructive",
      });
    },
  });

  // Get organizations for a specific user
  const getUserOrganizations = (userId: string): Organization[] => {
    if (!allOrgAdmins || !organizations) return [];
    const userOrgIds = allOrgAdmins
      .filter(admin => admin.userId === userId)
      .map(admin => admin.organizationId);
    return organizations.filter(org => userOrgIds.includes(org.id));
  };

  // Filter users based on search term
  const filteredUsers = users?.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    return fullName.includes(searchLower) || email.includes(searchLower);
  }) || [];

  // Handle action confirmation
  const handleConfirmAction = () => {
    if (!pendingAction) return;

    switch (pendingAction.type) {
      case 'toggleAdmin':
        toggleAdminMutation.mutate({
          userId: pendingAction.user.id,
          isAdmin: pendingAction.value!,
        });
        break;
      case 'toggleSuperAdmin':
        toggleSuperAdminMutation.mutate({
          userId: pendingAction.user.id,
          isSuperAdmin: pendingAction.value!,
        });
        break;
      case 'assignOrg':
        if (selectedOrgForAssign) {
          assignOrgAdminMutation.mutate({
            userId: pendingAction.user.id,
            organizationId: selectedOrgForAssign,
          });
        }
        break;
      case 'removeOrg':
        if (pendingAction.organizationId) {
          removeOrgAdminMutation.mutate({
            userId: pendingAction.user.id,
            organizationId: pendingAction.organizationId,
          });
        }
        break;
    }
  };

  const isPending = 
    toggleAdminMutation.isPending || 
    toggleSuperAdminMutation.isPending || 
    assignOrgAdminMutation.isPending || 
    removeOrgAdminMutation.isPending;

  // Loading state
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Access control - only super admins can access
  if (!currentUser?.isSuperAdmin) {
    return (
      <AccessDenied 
        message="Only super administrators can access user management."
        showHomeButton={true}
        showBackButton={true}
      />
    );
  }

  const isDataLoading = usersLoading || orgsLoading || orgAdminsLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#2B3A4A] text-white py-6 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <Button
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10 mb-2"
            onClick={() => navigate(`/org/${orgId}/admin`)}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Portal
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            User Management
          </h1>
          <p className="text-gray-300 mt-1">Manage users and permissions across the platform</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  All Users ({filteredUsers.length})
                </CardTitle>
                <CardDescription>
                  Manage user permissions and organization assignments
                </CardDescription>
              </div>
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-users"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isDataLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" data-testid="loader-users" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">
                  {searchTerm ? 'No users found matching your search.' : 'No users in the system.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Admin</TableHead>
                      <TableHead className="text-center">Super Admin</TableHead>
                      <TableHead>Organizations</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const userOrgs = getUserOrganizations(user.id);
                      return (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell className="font-medium">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.email || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {user.email || 'No email'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={user.isAdmin}
                              onCheckedChange={(checked) => {
                                setPendingAction({
                                  type: 'toggleAdmin',
                                  user,
                                  value: checked,
                                });
                              }}
                              disabled={user.isSuperAdmin}
                              data-testid={`switch-admin-${user.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={user.isSuperAdmin}
                              onCheckedChange={(checked) => {
                                setPendingAction({
                                  type: 'toggleSuperAdmin',
                                  user,
                                  value: checked,
                                });
                              }}
                              data-testid={`switch-super-admin-${user.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {userOrgs.length > 0 ? (
                                userOrgs.map(org => (
                                  <Badge
                                    key={org.id}
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-gray-200"
                                    onClick={() => {
                                      setPendingAction({
                                        type: 'removeOrg',
                                        user,
                                        organizationId: org.id,
                                        organizationName: org.name,
                                      });
                                    }}
                                    data-testid={`badge-org-${org.id}`}
                                  >
                                    {org.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-gray-400">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPendingAction({
                                  type: 'assignOrg',
                                  user,
                                });
                              }}
                              data-testid={`button-assign-org-${user.id}`}
                            >
                              <UserPlus className="w-3 h-3 mr-1" />
                              Assign Org
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialogs */}
      <Dialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === 'toggleAdmin' && 'Toggle Admin Status'}
              {pendingAction?.type === 'toggleSuperAdmin' && 'Toggle Super Admin Status'}
              {pendingAction?.type === 'assignOrg' && 'Assign Organization Admin'}
              {pendingAction?.type === 'removeOrg' && 'Remove Organization Admin'}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === 'toggleAdmin' && (
                pendingAction.value 
                  ? 'Grant admin privileges to this user?' 
                  : 'Remove admin privileges from this user?'
              )}
              {pendingAction?.type === 'toggleSuperAdmin' && (
                pendingAction.value
                  ? 'Grant super admin privileges to this user? Super admins have access to all features and organizations.'
                  : 'Remove super admin privileges from this user?'
              )}
              {pendingAction?.type === 'assignOrg' && 
                'Select an organization to assign this user as an admin.'
              }
              {pendingAction?.type === 'removeOrg' && 
                `Remove ${pendingAction.user.firstName} ${pendingAction.user.lastName} as admin of ${pendingAction.organizationName}?`
              }
            </DialogDescription>
          </DialogHeader>

          {/* User info */}
          {pendingAction && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">
                    {pendingAction.user.firstName} {pendingAction.user.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{pendingAction.user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Organization selector for assign action */}
          {pendingAction?.type === 'assignOrg' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization</label>
              <Select value={selectedOrgForAssign} onValueChange={setSelectedOrgForAssign}>
                <SelectTrigger data-testid="select-organization">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations?.map(org => {
                    const userOrgs = getUserOrganizations(pendingAction.user.id);
                    const isAlreadyAdmin = userOrgs.some(uOrg => uOrg.id === org.id);
                    return (
                      <SelectItem 
                        key={org.id} 
                        value={org.id}
                        disabled={isAlreadyAdmin}
                        data-testid={`option-org-${org.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {org.name}
                          {isAlreadyAdmin && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Already Admin
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Warning for super admin toggle */}
          {pendingAction?.type === 'toggleSuperAdmin' && pendingAction.value && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Super admins have unrestricted access to all organizations and features. Only grant this permission to trusted users.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingAction(null);
                setSelectedOrgForAssign("");
              }}
              disabled={isPending}
              data-testid="button-cancel-action"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={isPending || (pendingAction?.type === 'assignOrg' && !selectedOrgForAssign)}
              data-testid="button-confirm-action"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
