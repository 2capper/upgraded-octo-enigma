import { useNavigate } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

export function WelcomePage() {
  const [, navigate] = useNavigate();

  const handleCreateOrg = () => {
    navigate('/admin/org-settings');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Trophy className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to Dugout Desk!
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            The all-in-one platform for managing your youth sports league or tournament.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Getting Started
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              You're not part of an organization yet. To get started with Dugout Desk, 
              you'll need to create an organization for your league or tournament.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              What you can do with your organization:
            </h4>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                <span>Create and manage tournaments with automatic standings</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                <span>Generate playoff brackets with SP11.2 tie-breaking rules</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                <span>Track scores and manage game schedules</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                <span>Provide public tournament access for teams and spectators</span>
              </li>
            </ul>
          </div>

          <Button 
            onClick={handleCreateOrg} 
            className="w-full text-lg py-6 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
            data-testid="button-create-org"
          >
            Create Your Organization
          </Button>

          <p className="text-sm text-center text-gray-500 dark:text-gray-400">
            Setting up your organization takes less than a minute
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
