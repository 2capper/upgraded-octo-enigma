import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TeamManagement } from "@/components/booking/team-management";
import { useEffect } from "react";

export default function TeamManagementPage() {
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
      setLocation(`/org/${orgId}/admin`);
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
          <Link href={`/org/${orgId}/admin`}>
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10 mb-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin Portal
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{organization?.name || 'Loading...'}</h1>
          <p className="text-gray-300 mt-1">Team Management</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <TeamManagement organizationId={orgId!} />
      </div>
    </div>
  );
}
