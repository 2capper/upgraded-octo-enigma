import { db } from './server/db';
import { storage } from './server/storage';

async function testBracketGeneration() {
  console.log('Testing bracket generation for all test tournaments...\n');
  
  const testTournamentIds = [
    'test-12-team-top-6-standard-2025-11',
    'test-12-team-top-6-cross-pool-2025-11',
    'test-16-team-top-8-standard-2025-11',
    'test-16-team-top-8-cross-pool-2025-11',
  ];
  
  for (const tournamentId of testTournamentIds) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Testing: ${tournamentId}`);
      console.log('='.repeat(80));
      
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) {
        console.log(`❌ Tournament not found: ${tournamentId}`);
        continue;
      }
      
      console.log(`Tournament: ${tournament.name}`);
      console.log(`Playoff Format: ${tournament.playoffFormat}`);
      console.log(`Seeding Pattern: ${tournament.seedingPattern}`);
      console.log(`Number of Pools: ${tournament.numberOfPools}`);
      
      const divisions = await storage.getAgeDivisions(tournamentId);
      if (divisions.length === 0) {
        console.log('❌ No divisions found');
        continue;
      }
      
      for (const division of divisions) {
        console.log(`\nDivision: ${division.name}`);
        
        try {
          const result = await storage.generatePlayoffBracket(tournamentId, division.id);
          console.log(`✅ Bracket generated successfully!`);
          console.log(`   Created ${result.games.length} playoff games`);
          
          if (result.seededTeams && result.seededTeams.length > 0) {
            console.log(`\nSeeded Teams:`);
            result.seededTeams.forEach((team, index) => {
              const poolInfo = team.poolName && team.poolRank 
                ? ` (${team.poolName} #${team.poolRank})`
                : '';
              console.log(`   Seed ${team.seed}: ${team.teamName || team.teamId}${poolInfo}`);
            });
          }
          
          if (result.games && result.games.length > 0) {
            console.log(`\nFirst few playoff games:`);
            result.games.slice(0, 3).forEach(game => {
              const team1 = game.homeTeamId || `Winner of Game ${game.team1Source?.gameNumber}` || 'TBD';
              const team2 = game.awayTeamId || `Winner of Game ${game.team2Source?.gameNumber}` || 'TBD';
              console.log(`   Game ${game.playoffGameNumber} (Round ${game.playoffRound}): ${team1} vs ${team2}`);
            });
          }
          
        } catch (error) {
          console.log(`❌ Error generating bracket: ${(error as Error).message}`);
          if (error instanceof Error && error.stack) {
            console.log('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Error processing tournament: ${(error as Error).message}`);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('Test completed!');
  console.log('='.repeat(80));
  
  await db.$client.end();
  process.exit(0);
}

testBracketGeneration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
