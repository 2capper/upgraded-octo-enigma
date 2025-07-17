import { useState } from 'react';
import { useParams } from 'wouter';
import { Loader2, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTournamentData } from '@/hooks/use-tournament-data';
import { ScoreSubmissionNew } from '@/components/tournament/score-submission-new';
import { SimpleNavigation } from '@/components/tournament/simple-navigation';

export default function CoachScoreInput() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const currentTournamentId = tournamentId || 'aug-classic';
  const { teams, games, pools, tournaments, loading, error } = useTournamentData(currentTournamentId);

  const currentTournament = tournaments.find(t => t.id === currentTournamentId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--falcons-green)] mx-auto mb-4" />
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
            className="bg-[var(--falcons-green)] text-white px-4 py-2 rounded hover:bg-[var(--falcons-dark-green)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleNavigation tournamentId={currentTournamentId} currentPage="coach" />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-gray-900">
              Game Score Submission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-600 mb-6">
              <p>Use this form to submit final scores for completed games.</p>
              <p className="text-sm mt-2">
                This page is for coaches and tournament officials only.
              </p>
            </div>
          </CardContent>
        </Card>

        <ScoreSubmissionNew 
          games={games}
          teams={teams}
          pools={pools}
          tournamentId={currentTournamentId}
        />

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900">How to Submit Scores:</h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 mt-2">
                <li>Select the pool your game was played in</li>
                <li>Choose the specific game from the dropdown</li>
                <li>Enter the final score for both teams</li>
                <li>Record the innings batted for each team</li>
                <li>Select forfeit status if applicable</li>
                <li>Click "Submit Final Score" to complete</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900">Important Notes:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700 mt-2">
                <li>Double-check all information before submitting</li>
                <li>Scores cannot be edited once submitted without admin intervention</li>
                <li>Contact tournament officials if you encounter any issues</li>
                <li>Innings should be recorded as whole numbers (e.g., 4, 5) or half innings (e.g., 4.5, 5.5)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}