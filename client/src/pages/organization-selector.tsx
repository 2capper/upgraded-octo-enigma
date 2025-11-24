import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  hasDiamondBooking: boolean;
};

export default function OrganizationSelector() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: organizations, isLoading, error } = useQuery<Organization[]>({
    queryKey: ['/api/users/me/organizations'],
  });

  const { data: user } = useQuery<{ isSuperAdmin?: boolean }>({
    queryKey: ['/api/auth/me'],
  });

  // Fetch accepted coach invitations to determine if user is a coach
  const { data: coachInvites } = useQuery<Array<{ organizationId: string }>>({
    queryKey: ['/api/coach-invitations/accepted'],
    enabled: !!user,
  });

  const handleDeleteClick = (e: React.MouseEvent, org: Organization) => {
    e.stopPropagation(); // Prevent card click
    setOrgToDelete(org);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orgToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/organizations/${orgToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast({
        title: "Organization deleted",
        description: `${orgToDelete.name} has been permanently deleted.`,
      });

      // Invalidate and refetch organizations list
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/organizations'] });
      
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete organization. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!isLoading && organizations && !user?.isSuperAdmin && coachInvites !== undefined) {
      // Auto-redirect if user has exactly one organization (skip for super admins)
      if (organizations.length === 1) {
        const org = organizations[0];
        // Check if user is a coach for this org (not an admin)
        const isCoach = coachInvites.some(inv => inv.organizationId === org.id);
        // Route coaches to booking, admins to admin portal
        const destination = isCoach ? `/org/${org.id}/booking` : `/org/${org.id}/admin`;
        setLocation(destination);
      }
    }
  }, [organizations, isLoading, user, coachInvites, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your organizations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load organizations. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If user has no organizations, show request access message
  if (!organizations || organizations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <Building2 className="h-12 w-12 text-slate-400 mb-4" />
            <CardTitle>No Organizations Found</CardTitle>
            <CardDescription>
              You don't have access to any organizations yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              To get started, request admin access for your organization. Once approved, 
              you'll be able to manage bookings and tournaments.
            </p>
            <Button 
              className="w-full" 
              onClick={() => setLocation("/")}
              data-testid="button-request-access"
            >
              Request Admin Access
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user has multiple organizations, show selector
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Select Organization
          </h1>
          <p className="text-slate-600">
            {user?.isSuperAdmin 
              ? "You have super admin access to all organizations"
              : `Choose which organization you'd like to manage`}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {organizations.map((org) => {
            // Check if user is a coach for this org (not an admin)
            const isCoach = coachInvites?.some(inv => inv.organizationId === org.id) || false;
            // Route coaches to booking, admins to admin portal
            const destinationUrl = isCoach ? `/org/${org.id}/booking` : `/org/${org.id}/admin`;
            
            return (
              <Card 
                key={org.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setLocation(destinationUrl)}
                data-testid={`card-organization-${org.id}`}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    {org.logoUrl ? (
                      <img 
                        src={org.logoUrl} 
                        alt={`${org.name} logo`}
                        className="h-12 w-12 object-contain rounded"
                      />
                    ) : (
                      <div 
                        className="h-12 w-12 rounded flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: org.primaryColor }}
                      >
                        {org.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-xl">{org.name}</CardTitle>
                      {org.description && (
                        <CardDescription className="mt-1">
                          {org.description}
                        </CardDescription>
                      )}
                    </div>
                    {user?.isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => handleDeleteClick(e, org)}
                        data-testid={`button-delete-${org.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    style={{ backgroundColor: org.primaryColor }}
                    data-testid={`button-select-${org.id}`}
                  >
                    {coachInvites?.some(inv => inv.organizationId === org.id) 
                      ? 'Open Booking Dashboard' 
                      : 'Open Admin Portal'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {user?.isSuperAdmin && (
          <div className="mt-8 text-center">
            <Button 
              variant="outline"
              onClick={() => setLocation("/admin")}
              data-testid="button-super-admin-portal"
            >
              Super Admin Portal
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{orgToDelete?.name}</strong>? 
              This will permanently delete all tournaments, teams, games, and booking data 
              associated with this organization. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Organization'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
