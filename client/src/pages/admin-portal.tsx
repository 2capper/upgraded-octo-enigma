import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Loader2, Shield, Database, Users, Calendar, Plus, Download, Edit3, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTournamentData } from '@/hooks/use-tournament-data';
import { AdminPortalNew } from '@/components/tournament/admin-portal-new';
import { SimpleNavigation } from '@/components/tournament/simple-navigation';
import { TournamentCreationForm } from '@/components/tournament/tournament-creation-form';
import { TournamentManager } from '@/components/tournament/tournament-manager';
import { GameResultEditor } from '@/components/tournament/game-result-editor';
import { CSVReimportTool } from '@/components/tournament/csv-reimport-tool';
import { TeamIdScanner } from '@/components/tournament/team-id-scanner';
import { PasswordResetTool } from '@/components/tournament/password-reset-tool';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isUnauthorizedError } from '@/lib/authUtils';

export default function AdminPortal() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const currentTournamentId = tournamentId || 'fg-baseball-11u-13u-2025-08';
  const { teams, games, pools, tournaments, ageDivisions, loading, error } = useTournamentData(currentTournamentId);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('tournaments');
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const currentTournament = tournaments.find(t => t.id === currentTournamentId);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const handleNewTournament = () => {
    // Switch to tournaments tab where the creation form is
    setActiveTab('tournaments');
    setShowCreateForm(true);
    toast({
      title: "Create New Tournament",
      description: "Fill out the form to create a new tournament.",
    });
  };

  const handleExportData = () => {
    // TODO: Implement data export functionality
    console.log('Export tournament data');
    
    // Generate CSV export for tournament data
    const csvData = {
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        poolId: team.poolId,
        poolName: pools.find(p => p.id === team.poolId)?.name || 'Unknown'
      })),
      games: games.map(game => ({
        id: game.id,
        homeTeam: teams.find(t => t.id === game.homeTeamId)?.name || 'Unknown',
        awayTeam: teams.find(t => t.id === game.awayTeamId)?.name || 'Unknown',
        homeScore: game.homeScore || 0,
        awayScore: game.awayScore || 0,
        status: game.status,
        poolName: pools.find(p => p.id === game.poolId)?.name || 'Unknown'
      }))
    };
    
    // Convert to CSV and download
    const teamsCSV = [
      'Team ID,Team Name,Pool ID,Pool Name',
      ...csvData.teams.map(team => `${team.id},${team.name},${team.poolId},${team.poolName}`)
    ].join('\n');
    
    const gamesCSV = [
      'Game ID,Home Team,Away Team,Home Score,Away Score,Status,Pool Name',
      ...csvData.games.map(game => `${game.id},${game.homeTeam},${game.awayTeam},${game.homeScore},${game.awayScore},${game.status},${game.poolName}`)
    ].join('\n');
    
    // Download teams CSV
    const teamsBlob = new Blob([teamsCSV], { type: 'text/csv' });
    const teamsUrl = URL.createObjectURL(teamsBlob);
    const teamsLink = document.createElement('a');
    teamsLink.href = teamsUrl;
    teamsLink.download = `${currentTournamentId}_teams.csv`;
    teamsLink.click();
    
    // Download games CSV
    const gamesBlob = new Blob([gamesCSV], { type: 'text/csv' });
    const gamesUrl = URL.createObjectURL(gamesBlob);
    const gamesLink = document.createElement('a');
    gamesLink.href = gamesUrl;
    gamesLink.download = `${currentTournamentId}_games.csv`;
    gamesLink.click();
    
    toast({
      title: "Data Exported",
      description: "Tournament data has been exported to CSV files.",
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--falcons-green)] mx-auto mb-4" />
          <p className="text-gray-600">{authLoading ? "Checking authentication..." : "Loading admin portal..."}</p>
        </div>
      </div>
    );
  }
  
  // Don't render admin content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading tournament data: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-[var(--falcons-green)] text-white px-4 py-2 rounded hover:bg-[var(--falcons-dark-green)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const completedGames = games.filter(g => g.status === 'completed').length;
  const scheduledGames = games.filter(g => g.status === 'scheduled').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleNavigation tournamentId={currentTournamentId} currentPage="admin" />

      {/* Main Content */}
      <div className="px-4 py-4 md:py-8">
        
        {/* Warning Banner with Logout */}
        <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-red-800">Admin Access Only</h3>
                <p className="text-sm text-red-700 mt-1">
                  This portal is restricted to tournament administrators.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/api/logout"}
              className="ml-4"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Database className="h-6 w-6 text-[var(--falcons-green)] mr-3" />
              <div>
                <p className="text-xs text-gray-600">Divisions</p>
                <p className="text-xl font-bold text-gray-900">{ageDivisions.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="h-6 w-6 text-[var(--falcons-green)] mr-3" />
              <div>
                <p className="text-xs text-gray-600">Teams</p>
                <p className="text-xl font-bold text-gray-900">{teams.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-[var(--falcons-green)] mr-3" />
              <div>
                <p className="text-xs text-gray-600">Completed</p>
                <p className="text-xl font-bold text-gray-900">{completedGames}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-orange-500 mr-3" />
              <div>
                <p className="text-xs text-gray-600">Scheduled</p>
                <p className="text-xl font-bold text-gray-900">{scheduledGames}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Action Buttons */}
        <div className="flex justify-end mb-4">
          <Button 
            onClick={handleExportData}
            className="bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors text-sm"
          >
            <Download className="w-4 h-4 mr-1" />
            Export Data
          </Button>
        </div>

        {/* Admin Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full tabs-forest">
          <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full gap-1 h-auto">
            <TabsTrigger value="tournaments" className="text-xs md:text-sm py-2">Tournaments</TabsTrigger>
            <TabsTrigger value="import" className="text-xs md:text-sm py-2">Data Import</TabsTrigger>
            <TabsTrigger value="games" className="text-xs md:text-sm py-2">Edit Games</TabsTrigger>
            <TabsTrigger value="scanner" className="text-xs md:text-sm py-2">Team Scanner</TabsTrigger>
            <TabsTrigger value="auth" className="text-xs md:text-sm py-2">Auth Debug</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs md:text-sm py-2">Reports</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tournaments" className="mt-6">
            <div className="space-y-6">
              <TournamentCreationForm 
                showForm={showCreateForm}
                onSuccess={(tournament) => {
                  console.log('Tournament created:', tournament);
                  setShowCreateForm(false);
                }}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle>Existing Tournaments</CardTitle>
                </CardHeader>
                <CardContent>
                  <TournamentManager tournaments={tournaments} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <div className="space-y-6">
              <AdminPortalNew 
                tournamentId={currentTournamentId}
                onImportSuccess={() => {
                  console.log('Import successful, data updated via queries');
                }}
              />
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-50 px-2 text-gray-500">Or fix existing data</span>
                </div>
              </div>
              
              <CSVReimportTool tournamentId={currentTournamentId} />
            </div>
          </TabsContent>

          <TabsContent value="games" className="mt-6">
            <GameResultEditor
              games={games}
              teams={teams}
              tournamentId={currentTournamentId}
            />
          </TabsContent>
          
          <TabsContent value="scanner" className="mt-6">
            <TeamIdScanner />
          </TabsContent>
          
          <TabsContent value="auth" className="mt-6">
            <PasswordResetTool />
          </TabsContent>
          
          <TabsContent value="manage" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Tournament Data</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Current tournament has {teams.length} teams across {pools.length} pools
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => window.open(`/coach-score-input/${currentTournamentId}`, '_blank')}
                      >
                        Open Score Input Portal
                      </Button>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Game Status</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        {completedGames} completed, {scheduledGames} scheduled
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => window.open(`/dashboard/${currentTournamentId}`, '_blank')}
                      >
                        View Public Dashboard
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reports" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tournament Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Tournament Overview</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-600">Age Divisions</p>
                        <p className="text-xl font-bold">{ageDivisions.length}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-600">Pools</p>
                        <p className="text-xl font-bold">{pools.length}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-600">Teams</p>
                        <p className="text-xl font-bold">{teams.length}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-600">Total Games</p>
                        <p className="text-xl font-bold">{games.length}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Game Progress</h4>
                    <div className="bg-gray-50 p-4 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Completion Rate</span>
                        <span className="font-semibold">
                          {games.length > 0 ? Math.round((completedGames / games.length) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-[var(--falcons-green)] h-2 rounded-full" 
                          style={{ 
                            width: `${games.length > 0 ? (completedGames / games.length) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}