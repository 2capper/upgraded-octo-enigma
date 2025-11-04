import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Shield, Database, Users, Calendar, Plus, Download, Edit3, LogOut, Settings, Menu, Trophy, FileInput, Edit, Target, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useTournamentData } from '@/hooks/use-tournament-data';
import { AdminPortalNew } from '@/components/tournament/admin-portal-new';
import { SimpleNavigation } from '@/components/tournament/simple-navigation';
import { TournamentCreationForm } from '@/components/tournament/tournament-creation-form';
import { TournamentManager } from '@/components/tournament/tournament-manager';
import { GameResultEditor } from '@/components/tournament/game-result-editor';
import { CSVReimportTool } from '@/components/tournament/csv-reimport-tool';
import { TeamIdScanner } from '@/components/tournament/team-id-scanner';
import { PasswordResetTool } from '@/components/tournament/password-reset-tool';
import { AdminRequestsTab } from '@/components/admin-requests-tab';
import { TeamEditor } from '@/components/tournament/team-editor';
import { PlayoffBracketGenerator } from '@/components/tournament/playoff-bracket-generator';
import { FeatureManagement } from '@/components/admin/feature-management';
import { OrganizationSettings } from '@/components/admin/organization-settings';
import { OrganizationAdminManagement } from '@/components/admin/organization-admin-management';
import { OrganizationCreationForm } from '@/components/admin/organization-creation-form';
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
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const currentTournament = tournaments.find(t => t.id === currentTournamentId);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch pending admin requests count for super admins
  const { data: adminRequests } = useQuery<any[]>({
    queryKey: ['/api/admin-requests'],
    enabled: (user as any)?.isSuperAdmin === true,
  });

  const pendingRequestsCount = adminRequests?.filter((r: any) => r.status === 'pending').length || 0;

  // Check authentication - redirect to home instead of login to avoid loops
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, authLoading, setLocation]);

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--light-gray)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--field-green)' }} />
          <p className="text-[var(--text-secondary)]">{authLoading ? "Checking authentication..." : "Loading admin portal..."}</p>
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--light-gray)' }}>
        <div className="text-center">
          <p className="text-[var(--destructive)] mb-4">Error loading tournament data: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 rounded transition-colors font-semibold"
            style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--light-gray)' }}>
      <SimpleNavigation 
        tournamentId={currentTournamentId} 
        currentPage="admin" 
        tournament={currentTournament}
      />

      {/* Main Content */}
      <div className="px-4 py-4 md:py-8">
        
        {/* Warning Banner with Logout */}
        <div className="mb-4 p-3 border rounded-lg" style={{ borderColor: 'var(--field-green)', backgroundColor: 'rgba(58, 107, 53, 0.1)' }}>
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <Shield className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: 'var(--field-green)' }} />
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--field-green)' }}>Admin Access Only</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--deep-navy)' }}>
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
              <Database className="h-6 w-6 mr-3" style={{ color: 'var(--field-green)' }} />
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Divisions</p>
                <p className="text-xl font-bold" style={{ color: 'var(--deep-navy)' }}>{ageDivisions.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="h-6 w-6 mr-3" style={{ color: 'var(--field-green)' }} />
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Teams</p>
                <p className="text-xl font-bold" style={{ color: 'var(--deep-navy)' }}>{teams.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 mr-3" style={{ color: 'var(--field-green)' }} />
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Completed</p>
                <p className="text-xl font-bold" style={{ color: 'var(--deep-navy)' }}>{completedGames}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 mr-3" style={{ color: 'var(--clay-red)' }} />
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Scheduled</p>
                <p className="text-xl font-bold" style={{ color: 'var(--deep-navy)' }}>{scheduledGames}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Action Buttons */}
        <div className="flex justify-end mb-4">
          <Button 
            onClick={handleExportData}
            className="text-sm font-semibold transition-colors"
            style={{ backgroundColor: 'var(--field-green)', color: 'white' }}
          >
            <Download className="w-4 h-4 mr-1" />
            Export Data
          </Button>
        </div>

        {/* Admin Tabs - Responsive Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full tabs-forest">
          {/* Mobile Navigation - Hamburger Menu */}
          <div className="md:hidden mb-4">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full min-h-[48px] justify-between font-semibold"
                  style={{ borderColor: 'var(--deep-navy)', color: 'var(--deep-navy)' }}
                  data-testid="button-mobile-menu"
                >
                  <div className="flex items-center gap-2">
                    <Menu className="w-5 h-5" />
                    <span>Menu</span>
                  </div>
                  <span className="text-sm opacity-70">
                    {activeTab === 'tournaments' && 'Tournaments'}
                    {activeTab === 'import' && 'Data Import'}
                    {activeTab === 'teams' && 'Edit Teams'}
                    {activeTab === 'games' && 'Edit Games'}
                    {activeTab === 'playoffs' && 'Playoffs'}
                    {activeTab === 'reports' && 'Reports'}
                    {activeTab === 'create-org' && 'Create Org'}
                    {activeTab === 'org-settings' && 'Org Settings'}
                    {activeTab === 'org-admins' && 'Org Admins'}
                    {activeTab === 'features' && 'Features'}
                    {activeTab === 'admin-requests' && 'Admin Requests'}
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle style={{ color: 'var(--deep-navy)' }}>Admin Menu</SheetTitle>
                </SheetHeader>
                <TabsList className="mt-6 flex flex-col gap-2 w-full h-auto bg-transparent">
                  <TabsTrigger 
                    value="tournaments" 
                    className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                    style={activeTab === 'tournaments' ? { backgroundColor: 'var(--clay-red)' } : {}}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="nav-tournaments"
                  >
                    <Trophy className="w-5 h-5" />
                    Tournaments
                  </TabsTrigger>
                  <TabsTrigger 
                    value="import" 
                    className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                    style={activeTab === 'import' ? { backgroundColor: 'var(--clay-red)' } : {}}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="nav-import"
                  >
                    <FileInput className="w-5 h-5" />
                    Data Import
                  </TabsTrigger>
                  <TabsTrigger 
                    value="teams" 
                    className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                    style={activeTab === 'teams' ? { backgroundColor: 'var(--clay-red)' } : {}}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="nav-teams"
                  >
                    <Users className="w-5 h-5" />
                    Edit Teams
                  </TabsTrigger>
                  <TabsTrigger 
                    value="games" 
                    className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                    style={activeTab === 'games' ? { backgroundColor: 'var(--clay-red)' } : {}}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="nav-games"
                  >
                    <Edit className="w-5 h-5" />
                    Edit Games
                  </TabsTrigger>
                  <TabsTrigger 
                    value="playoffs" 
                    className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                    style={activeTab === 'playoffs' ? { backgroundColor: 'var(--clay-red)' } : {}}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="nav-playoffs"
                  >
                    <Target className="w-5 h-5" />
                    Playoffs
                  </TabsTrigger>
                  <TabsTrigger 
                    value="reports" 
                    className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                    style={activeTab === 'reports' ? { backgroundColor: 'var(--clay-red)' } : {}}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="nav-reports"
                  >
                    <FileText className="w-5 h-5" />
                    Reports
                  </TabsTrigger>
                  {(user as any)?.isSuperAdmin && (
                    <>
                      <div className="h-px bg-gray-200 my-2" />
                      <p className="text-xs uppercase font-semibold text-[var(--text-secondary)] px-4 mb-1">Super Admin</p>
                      <TabsTrigger 
                        value="create-org" 
                        className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                        style={activeTab === 'create-org' ? { backgroundColor: 'var(--clay-red)' } : {}}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="nav-create-org"
                      >
                        <Plus className="w-5 h-5" />
                        Create Org
                      </TabsTrigger>
                      <TabsTrigger 
                        value="org-settings" 
                        className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                        style={activeTab === 'org-settings' ? { backgroundColor: 'var(--clay-red)' } : {}}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="nav-org-settings"
                      >
                        <Settings className="w-5 h-5" />
                        Org Settings
                      </TabsTrigger>
                      <TabsTrigger 
                        value="org-admins" 
                        className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                        style={activeTab === 'org-admins' ? { backgroundColor: 'var(--clay-red)' } : {}}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="nav-org-admins"
                      >
                        <Users className="w-5 h-5" />
                        Org Admins
                      </TabsTrigger>
                      <TabsTrigger 
                        value="features" 
                        className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                        style={activeTab === 'features' ? { backgroundColor: 'var(--clay-red)' } : {}}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="nav-features"
                      >
                        <Settings className="w-5 h-5" />
                        Features
                      </TabsTrigger>
                      <TabsTrigger 
                        value="admin-requests" 
                        className="flex items-center gap-3 px-4 py-3 justify-start w-full data-[state=active]:text-white"
                        style={activeTab === 'admin-requests' ? { backgroundColor: 'var(--clay-red)' } : {}}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="nav-admin-requests"
                      >
                        <Shield className="w-5 h-5" />
                        Admin Requests
                        {pendingRequestsCount > 0 && (
                          <Badge className="ml-auto bg-red-500 text-white">
                            {pendingRequestsCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Navigation - Wrapping Tabs */}
          <div className="hidden md:block mb-4">
            <TabsList className="flex flex-wrap w-full gap-1 h-auto">
              <TabsTrigger value="tournaments" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-tournaments">Tournaments</TabsTrigger>
              <TabsTrigger value="import" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-import">Data Import</TabsTrigger>
              <TabsTrigger value="teams" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-teams">Edit Teams</TabsTrigger>
              <TabsTrigger value="games" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-games">Edit Games</TabsTrigger>
              <TabsTrigger value="playoffs" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-playoffs">Playoffs</TabsTrigger>
              <TabsTrigger value="reports" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-reports">Reports</TabsTrigger>
              {(user as any)?.isSuperAdmin && (
                <>
                  <div className="w-full h-0 basis-full" />
                  <div className="text-xs uppercase font-semibold text-[var(--text-secondary)] px-2 py-2 flex items-center">Super Admin</div>
                  <TabsTrigger value="create-org" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-create-org">
                    <Plus className="w-3 h-3 mr-1" />
                    Create Org
                  </TabsTrigger>
                  <TabsTrigger value="org-settings" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-org-settings">
                    <Settings className="w-3 h-3 mr-1" />
                    Org Settings
                  </TabsTrigger>
                  <TabsTrigger value="org-admins" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-org-admins">
                    <Users className="w-3 h-3 mr-1" />
                    Org Admins
                  </TabsTrigger>
                  <TabsTrigger value="features" className="text-sm py-2 px-4 flex-shrink-0" data-testid="tab-features">
                    <Settings className="w-3 h-3 mr-1" />
                    Features
                  </TabsTrigger>
                  <TabsTrigger value="admin-requests" className="text-sm py-2 px-4 flex-shrink-0 relative" data-testid="tab-admin-requests">
                    <Shield className="w-3 h-3 mr-1" />
                    Admin Requests
                    {pendingRequestsCount > 0 && (
                      <Badge className="ml-2 bg-red-500 text-white px-2 py-0.5 text-xs">
                        {pendingRequestsCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>
          
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
                  <span className="px-2 text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--light-gray)' }}>Or fix existing data</span>
                </div>
              </div>
              
              <CSVReimportTool tournamentId={currentTournamentId} />
            </div>
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Management</CardTitle>
              </CardHeader>
              <CardContent>
                <TeamEditor teams={teams} tournamentId={currentTournamentId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="games" className="mt-6">
            <GameResultEditor
              games={games}
              teams={teams}
              tournamentId={currentTournamentId}
            />
          </TabsContent>

          <TabsContent value="playoffs" className="mt-6">
            <PlayoffBracketGenerator tournamentId={currentTournamentId} />
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
                      <h4 className="font-semibold mb-2" style={{ color: 'var(--deep-navy)' }}>Tournament Data</h4>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">
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
                      <h4 className="font-semibold mb-2" style={{ color: 'var(--deep-navy)' }}>Game Status</h4>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">
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
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2" style={{ color: 'var(--deep-navy)' }}>Tournament Overview</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-white border border-[var(--card-border)] p-3 rounded">
                        <p className="text-[var(--text-secondary)]">Age Divisions</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--deep-navy)' }}>{ageDivisions.length}</p>
                      </div>
                      <div className="bg-white border border-[var(--card-border)] p-3 rounded">
                        <p className="text-[var(--text-secondary)]">Pools</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--deep-navy)' }}>{pools.length}</p>
                      </div>
                      <div className="bg-white border border-[var(--card-border)] p-3 rounded">
                        <p className="text-[var(--text-secondary)]">Teams</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--deep-navy)' }}>{teams.length}</p>
                      </div>
                      <div className="bg-white border border-[var(--card-border)] p-3 rounded">
                        <p className="text-[var(--text-secondary)]">Total Games</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--deep-navy)' }}>{games.length}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2" style={{ color: 'var(--deep-navy)' }}>Game Progress</h4>
                    <div className="bg-white border border-[var(--card-border)] p-4 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">Completion Rate</span>
                        <span className="font-semibold" style={{ color: 'var(--deep-navy)' }}>
                          {games.length > 0 ? Math.round((completedGames / games.length) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full rounded-full h-2 mt-2" style={{ backgroundColor: 'var(--light-gray)' }}>
                        <div 
                          className="h-2 rounded-full" 
                          style={{ 
                            backgroundColor: 'var(--field-green)',
                            width: `${games.length > 0 ? (completedGames / games.length) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-6">
                    <h4 className="font-semibold mb-2" style={{ color: 'var(--deep-navy)' }}>Validation Report</h4>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      Generate a comprehensive report showing all calculations, tie-breakers, seeding logic, and playoff brackets. 
                      This report provides transparency and can be shared with coaches to explain tournament results.
                    </p>
                    <Button 
                      variant="default"
                      onClick={() => window.open(`/admin/${currentTournamentId}/validation-report`, '_blank')}
                      disabled={!currentTournamentId}
                      data-testid="button-generate-validation-report"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Validation Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {(user as any)?.isSuperAdmin && (
            <>
              <TabsContent value="create-org" className="mt-6">
                <OrganizationCreationForm />
              </TabsContent>

              <TabsContent value="org-settings" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Organization Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OrganizationSettings />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="org-admins" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Organization Admins
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OrganizationAdminManagement />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="features" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Feature Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FeatureManagement />
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="admin-requests" className="mt-6">
                <AdminRequestsTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}