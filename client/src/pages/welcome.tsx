import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trophy, Sparkles, ArrowRight } from 'lucide-react';

export function WelcomePage() {
  const [, setLocation] = useLocation();

  // Fetch full user data to get firstName
  const { data: userData } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  const handleCreateOrg = () => {
    setLocation('/onboarding/create-organization');
  };

  // Use actual firstName from database, fallback to parsing email, then default to 'there'
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
            You're one step away from managing tournaments like a pro
          </p>
        </div>

        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/90 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-semibold text-gray-800">
              Let's create your organization
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-6 mb-8">
              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Quick Setup</h3>
                  <p className="text-sm text-gray-600">Takes less than 2 minutes to get started</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Manage Tournaments</h3>
                  <p className="text-sm text-gray-600">Create schedules, track scores, and generate brackets</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Go Live</h3>
                  <p className="text-sm text-gray-600">Share real-time standings with teams and fans</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleCreateOrg} 
              size="lg"
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
              data-testid="button-create-org"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            
            <p className="text-center text-sm text-gray-500 mt-4">
              No credit card required • Free to start
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
