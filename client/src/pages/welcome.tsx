import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export function WelcomePage() {
  const [, setLocation] = useLocation();

  const handleCreateOrg = () => {
    setLocation('/onboarding/create-organization');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">
            Welcome to Dugout Desk!
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Let's get you set up.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-8 text-base text-gray-700">
            You're not part of an organization yet. To use the app,
            you must first create one for your league or tournament.
          </p>

          <Button 
            onClick={handleCreateOrg} 
            className="w-full text-lg py-8"
            data-testid="button-create-org"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your Organization
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
