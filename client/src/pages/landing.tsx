import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Trophy, Users, Calendar } from 'lucide-react';

export default function Landing() {
  const handleSignIn = () => {
    window.location.href = '/api/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-[var(--falcons-green)] mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">DUGOUT DESK</h1>
            </div>
            <Button 
              onClick={handleSignIn}
              className="min-h-[48px] px-6 font-semibold text-white"
              style={{ backgroundColor: 'var(--clay-red)' }}
              data-testid="button-signin"
            >
              <Shield className="w-4 h-4 mr-2" />
              Sign In with Replit
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Professional Tournament Management
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Complete baseball tournament management system with real-time standings, 
            score tracking, and comprehensive team management. Built for the Forest Glade Falcons.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="h-6 w-6 text-[var(--falcons-green)] mr-3" />
                Real-Time Standings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Live tournament standings with proper tie-breaker logic and pool-based rankings.
                Track wins, losses, and run differentials automatically.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-6 w-6 text-[var(--falcons-green)] mr-3" />
                Team Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Comprehensive team profiles with roster integration from OBA databases.
                Import player rosters automatically with authentic data verification.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-6 w-6 text-[var(--falcons-green)] mr-3" />
                Game Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Complete game scheduling with venue management, score input, and playoff bracket generation.
                Supports forfeit tracking and inning-based scoring.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Public Access Notice */}
        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Public Tournament Access</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-blue-800">
                Tournament standings, schedules, and results are publicly available. 
                Visit any tournament page to view current standings and game results without signing in.
              </CardDescription>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-blue-700">
                  <strong>Public Access:</strong> View standings, games, teams, and playoff brackets
                </p>
                <p className="text-sm text-blue-700">
                  <strong>Admin Access:</strong> Tournament management, score editing, and data import
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Notice */}
        <div className="mt-8 text-center">
          <Card className="max-w-2xl mx-auto bg-orange-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-center text-orange-900">
                <Shield className="h-5 w-5 mr-2" />
                Administrator Access Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-orange-800">
                You need to sign in with an administrator account to access tournament management features, 
                edit game scores, or import team data.
              </CardDescription>
              <Button 
                onClick={handleSignIn}
                className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"
                data-testid="button-admin-signin"
              >
                Administrator Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}