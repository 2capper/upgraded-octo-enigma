import { useState } from 'react';
import { useParams } from 'wouter';
import { Loader2, Shield, Database, Users, Calendar, Plus, Download, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTournamentData } from '@/hooks/use-tournament-data';
import { AdminPortalNew } from '@/components/tournament/admin-portal-new';
import { SimpleNavigation } from '@/components/tournament/simple-navigation';
import { TournamentCreationForm } from '@/components/tournament/tournament-creation-form';
import { GameResultEditor } from '@/components/tournament/game-result-editor';
import { CSVReimportTool } from '@/components/tournament/csv-reimport-tool';
import { useToast } from '@/hooks/use-toast';

export default function AdminPortal() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const currentTournamentId = tournamentId || 'aug-classic';
  const { teams, games, pools, tournaments, ageDivisions, loading, error } = useTournamentData(currentTournamentId);
  const { toast } = useToast();

  const currentTournament = tournaments.find(t => t.id === currentTournamentId);

  const handleNewTournament = () => {
    // TODO: Implement new tournament creation
    console.log('Create new tournament');
    toast({
      title: "Feature Coming Soon",
      description: "Tournament creation feature will be available soon.",
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--falcons-green)] mx-auto mb-4" />
          <p className="text-gray-600">Loading admin portal...</p>
        </div>
      </div>
    );
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Warning Banner */}
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-red-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">Admin Access Only</h3>
                <p className="text-red-700">
                  This portal is restricted to tournament administrators. 
                  All actions are logged and monitored.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="flex items-center p-6">
              <Database className="h-8 w-8 text-[var(--falcons-green)] mr-4" />
              <div>
                <p className="text-sm font-medium text-gray-600">Age Divisions</p>
                <p className="text-2xl font-bold text-gray-900">{ageDivisions.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <Users className="h-8 w-8 text-[var(--falcons-green)] mr-4" />
              <div>
                <p className="text-sm font-medium text-gray-600">Teams</p>
                <p className="text-2xl font-bold text-gray-900">{teams.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <Calendar className="h-8 w-8 text-[var(--falcons-green)] mr-4" />
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Games</p>
                <p className="text-2xl font-bold text-gray-900">{completedGames}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <Calendar className="h-8 w-8 text-orange-500 mr-4" />
              <div>
                <p className="text-sm font-medium text-gray-600">Scheduled Games</p>
                <p className="text-2xl font-bold text-gray-900">{scheduledGames}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button 
            onClick={handleNewTournament}
            className="bg-[var(--falcons-green)] text-white hover:bg-[var(--falcons-dark-green)] transition-colors flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Tournament
          </Button>
          <Button 
            onClick={handleExportData}
            className="bg-[var(--falcons-gold)] text-white hover:bg-[var(--falcons-dark-gold)] transition-colors flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="tournaments" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="import">Data Import</TabsTrigger>
            <TabsTrigger value="games">Edit Games</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tournaments" className="mt-6">
            <div className="space-y-6">
              <TournamentCreationForm 
                onSuccess={(tournament) => {
                  console.log('Tournament created:', tournament);
                }}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle>Existing Tournaments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tournaments.map((tournament) => (
                      <div key={tournament.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{tournament.name}</h4>
                          <p className="text-sm text-gray-500">{tournament.date}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">ID: {tournament.id}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/tournament/${tournament.id}`, '_blank')}
                          >
                            View Tournament
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
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