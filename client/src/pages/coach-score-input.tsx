import { useParams } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useTournamentData } from '@/hooks/use-tournament-data';
import { HierarchicalScoreInput } from '@/components/tournament/hierarchical-score-input';
import { SimpleNavigation } from '@/components/tournament/simple-navigation';

export default function CoachScoreInput() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const currentTournamentId = tournamentId || 'fg-baseball-11u-13u-2025-08';
  const { teams, games, pools, tournaments, ageDivisions, loading, error } = useTournamentData(currentTournamentId);

  const currentTournament = tournaments.find(t => t.id === currentTournamentId);
  
  const primaryColor = currentTournament?.primaryColor || '#22c55e';
  const secondaryColor = currentTournament?.secondaryColor || '#facc15';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 
            className="w-8 h-8 animate-spin mx-auto mb-4" 
            style={{ color: primaryColor }}
          />
          <p className="text-gray-600">Loading score submission...</p>
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
            className="px-4 py-2 rounded font-medium transition-colors"
            style={{ 
              backgroundColor: primaryColor, 
              color: secondaryColor 
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleNavigation 
        tournamentId={currentTournamentId} 
        currentPage="coach" 
        tournament={currentTournament}
      />

      <div className="max-w-4xl mx-auto px-4 py-4 md:py-8">
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 text-center">
            Game Score Submission
          </h1>
          <p className="text-sm text-gray-600 text-center mt-2">
            Submit final scores for completed games
          </p>
        </div>

        <HierarchicalScoreInput 
          games={games}
          teams={teams}
          pools={pools}
          ageDivisions={ageDivisions}
          tournamentId={currentTournamentId}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />

        <details className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <summary 
            className="font-semibold cursor-pointer"
            style={{ color: primaryColor }}
          >
            Need Help? View Instructions
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 text-sm">How to Submit Scores:</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm mt-2">
                <li>Select your age division (11U or 13U)</li>
                <li>Choose your team from the division</li>
                <li>Select the specific pool game to report</li>
                <li>Enter the final score for both teams</li>
                <li>Record the innings batted for each team</li>
                <li>Select forfeit status if applicable</li>
                <li>Click "Submit Final Score" to complete</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 text-sm">Important Notes:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm mt-2">
                <li>Double-check all information before submitting</li>
                <li>Scores cannot be edited once submitted without admin intervention</li>
                <li>Contact tournament officials if you encounter any issues</li>
                <li>Innings should be recorded as whole numbers (e.g., 4, 5) or half innings (e.g., 4.5, 5.5)</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
