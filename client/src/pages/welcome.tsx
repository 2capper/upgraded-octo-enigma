import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trophy, Sparkles, ArrowRight, Search, Building2, Plus, Loader2, MapPin, CheckCircle2, LogIn } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Organization } from '@shared/schema';

export function WelcomePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const { data: userData } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<Organization[]>({
    queryKey: ['/api/organizations/unclaimed/search', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const response = await fetch(`/api/organizations/unclaimed/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const claimMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      return apiRequest('POST', `/api/organizations/${organizationId}/claim`);
    },
    onSuccess: (data: Organization) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/organizations'] });
      toast({
        title: 'Organization Claimed!',
        description: `You are now the admin of ${data.name}`,
      });
      setLocation(`/org/${data.id}/admin`);
    },
    onError: (error: any) => {
      toast({
        title: 'Claim Failed',
        description: error.message || 'Failed to claim organization',
        variant: 'destructive',
      });
    },
  });

  const handleCreateOrg = () => {
    setLocation('/onboarding/create-organization');
  };

  const handleClaim = () => {
    if (selectedOrg) {
      claimMutation.mutate(selectedOrg.id);
    }
  };

  let firstName = 'there';
  
  if (userData?.firstName) {
    firstName = userData.firstName;
  } else if (userData?.email) {
    const emailPrefix = userData.email.split('@')[0];
    if (emailPrefix && !['admin', 'info', 'contact', 'support', 'help'].includes(emailPrefix.toLowerCase())) {
      const namePart = emailPrefix.split('.')[0];
      if (namePart && namePart.length > 0) {
        firstName = namePart;
      }
    }
  }
  
  const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl mb-6 shadow-lg">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Welcome, {capitalizedFirstName}! <Sparkles className="inline w-8 h-8 text-yellow-500 ml-2" />
          </h1>
          
          <p className="text-xl text-gray-600 mb-2">
            Let's get you set up to manage tournaments
          </p>
        </div>

        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/90 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 mb-6">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-semibold text-gray-800 flex items-center justify-center gap-2">
              <Search className="w-6 h-6" />
              Find Your Organization
            </CardTitle>
            <CardDescription className="text-base">
              Search for unclaimed associations in our OBA directory
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or city (e.g., 'Ajax' or 'Burlington')"
                className="pl-10 h-12 text-base"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedOrg(null);
                }}
                data-testid="input-search-org"
              />
            </div>

            {isSearching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Searching...</span>
              </div>
            )}

            {searchQuery.length >= 2 && !isSearching && searchResults && searchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => setSelectedOrg(org)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedOrg?.id === org.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                    data-testid={`button-select-org-${org.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          {org.name}
                        </div>
                        {org.city && (
                          <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {org.city}
                          </div>
                        )}
                      </div>
                      {selectedOrg?.id === org.id && (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !isSearching && searchResults && searchResults.length === 0 && (
              <div className="mt-4 text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No matching organizations found</p>
                <p className="text-sm text-gray-500 mt-1">Try a different search term or create a new organization below</p>
              </div>
            )}

            {selectedOrg && (
              <div className="mt-4">
                <Button 
                  onClick={handleClaim}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={claimMutation.isPending}
                  data-testid="button-claim-org"
                >
                  {claimMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Claim {selectedOrg.name}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gradient-to-br from-blue-50 via-white to-green-50 text-gray-500 font-medium">
              OR
            </span>
          </div>
        </div>

        <Card className="shadow-xl border-0 backdrop-blur-sm bg-white/90 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 mt-6">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-semibold text-gray-800 flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Organization
            </CardTitle>
            <CardDescription>
              Not in the directory? Create a fresh organization
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button 
              onClick={handleCreateOrg} 
              size="lg"
              variant="outline"
              className="w-full h-12 text-base font-semibold border-2 hover:bg-gray-50"
              data-testid="button-create-org"
            >
              Create New Organization
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            
            <p className="text-center text-sm text-gray-500 mt-4">
              No credit card required • Free to start
            </p>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Looking to join an existing organization?{' '}
            <Button
              variant="link"
              className="p-0 h-auto text-sm font-semibold text-blue-600 hover:text-blue-800"
              onClick={() => setLocation('/request-admin-access')}
              data-testid="link-join-org"
            >
              Request access here
            </Button>
          </p>
        </div>

        <Card className="shadow-lg border-2 border-green-200 bg-green-50/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 mt-6">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 justify-center sm:justify-start">
                  <LogIn className="w-5 h-5 text-green-600" />
                  Already an admin?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  If your organization is already set up, just go to your dashboard
                </p>
              </div>
              <Button 
                onClick={() => setLocation('/orgs')}
                variant="outline"
                className="border-green-600 text-green-700 hover:bg-green-100 font-semibold whitespace-nowrap"
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
