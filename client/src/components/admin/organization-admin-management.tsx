import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, UserPlus, UserMinus, Loader2, Building2, Shield, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Organization, User } from '@shared/schema';

interface OrganizationAdmin {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  user?: User;
}

interface AssignAdminDialogProps {
  organization: Organization;
  onSuccess: () => void;
}

function AssignAdminDialog({ organization, onSuccess }: AssignAdminDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  const assignMutation = useMutation({
    mutationFn: async (userEmail: string) => {
      // First, get all users to find the one with matching email
      const usersResponse = await fetch('/api/users');
      if (!usersResponse.ok) throw new Error('Failed to fetch users');
      const users: User[] = await usersResponse.json();
      
      const user = users.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
      if (!user) {
        throw new Error(`No user found with email: ${userEmail}`);
      }

      return apiRequest('POST', `/api/organizations/${organization.id}/admins`, {
        userId: user.id,
        role: 'admin',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organization.id, 'admins'] });
      toast({
        title: "Admin Assigned",
        description: `${email} has been added as an admin for ${organization.name}.`,
      });
      setIsOpen(false);
      setEmail('');
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign admin. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter a user's email address.",
        variant: "destructive",
      });
      return;
    }
    assignMutation.mutate(email.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="min-h-[48px] font-semibold"
          style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
          data-testid={`button-assign-admin-${organization.slug}`}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Assign Admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Organization Admin</DialogTitle>
          <DialogDescription>
            Add an admin for {organization.name}. Enter the email address of an existing user.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">User Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              data-testid="input-admin-email"
            />
            <p className="text-sm text-muted-foreground">
              The user must have an account in the system.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={assignMutation.isPending}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={assignMutation.isPending}
              className="min-h-[48px] font-semibold"
              style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Admin'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RemoveAdminDialogProps {
  organization: Organization;
  admin: OrganizationAdmin;
  onSuccess: () => void;
}

function RemoveAdminDialog({ organization, admin, onSuccess }: RemoveAdminDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const removeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/organizations/${organization.id}/admins/${admin.userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organization.id, 'admins'] });
      toast({
        title: "Admin Removed",
        description: `Admin access has been removed for ${organization.name}.`,
      });
      setIsOpen(false);
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Removal Failed",
        description: "Failed to remove admin. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRemove = () => {
    removeMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid={`button-remove-admin-${admin.userId}`}
        >
          <UserMinus className="w-3 h-3 mr-1" />
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Organization Admin</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this admin from {organization.name}?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {admin.user?.firstName} {admin.user?.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{admin.user?.email}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={removeMutation.isPending}
            data-testid="button-cancel-remove"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            data-testid="button-confirm-remove"
          >
            {removeMutation.isPending ? (
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
  );
}

interface OrganizationAdminCardProps {
  organization: Organization;
}

function OrganizationAdminCard({ organization }: OrganizationAdminCardProps) {
  const { data: admins, isLoading } = useQuery<OrganizationAdmin[]>({
    queryKey: ['/api/organizations', organization.id, 'admins'],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organization.id}/admins`);
      if (!response.ok) throw new Error('Failed to fetch admins');
      return response.json();
    },
  });

  // Fetch all users to display admin details
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  const adminsWithUsers = admins?.map(admin => ({
    ...admin,
    user: users?.find(u => u.id === admin.userId),
  }));

  return (
    <Card className="border-2" data-testid={`card-org-admins-${organization.slug}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {organization.name}
            </CardTitle>
            <CardDescription>
              {organization.description || 'No description provided'}
            </CardDescription>
          </div>
          <AssignAdminDialog
            organization={organization}
            onSuccess={() => {
              // Admins list will auto-refresh via query invalidation
            }}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : adminsWithUsers && adminsWithUsers.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <Shield className="w-4 h-4" />
              Organization Admins ({adminsWithUsers.length})
            </div>
            <div className="space-y-2">
              {adminsWithUsers.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid={`admin-item-${admin.userId}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {admin.user?.firstName} {admin.user?.lastName}
                        {admin.user?.isSuperAdmin && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Super Admin
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {admin.user?.email || 'No email'}
                      </div>
                    </div>
                  </div>
                  <RemoveAdminDialog
                    organization={organization}
                    admin={admin}
                    onSuccess={() => {
                      // Admins list will auto-refresh via query invalidation
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No admins assigned to this organization yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Assign Admin" above to add one.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OrganizationAdminManagement() {
  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Organizations</h3>
        <p className="text-muted-foreground">
          Create an organization first to manage its admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          Assign organization admins to give users the ability to manage tournaments and teams within a specific organization. Super admins have access to all organizations automatically.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {organizations.map((org) => (
          <OrganizationAdminCard key={org.id} organization={org} />
        ))}
      </div>
    </div>
  );
}
