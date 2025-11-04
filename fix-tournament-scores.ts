import { db } from './server/db';
import { games } from '@shared/schema';
import { eq } from 'drizzle-orm';

const TOURNAMENT_ID = 'test-12-team-top-6-cross-pool-2025-11';

async function fixTournamentScores() {
  console.log('Fixing tournament scores to match tie-breaker scenarios...\n');

  // Pool B: 2-way tie for first place
  // Target: Grizzlies 2-1, Crusaders 2-1 (tied), Blazers 1-2, Orcas 1-2
  const poolBUpdates = [
    // Game 1: Grizzlies 5, Crusaders 3 (Grizzlies win)
    { id: `${TOURNAMENT_ID}-pool-b-game-1`, homeScore: 5, awayScore: 3 },
    // Game 2: Blazers 4, Orcas 2 (Blazers win)
    { id: `${TOURNAMENT_ID}-pool-b-game-2`, homeScore: 4, awayScore: 2 },
    // Game 3: Grizzlies 2, Blazers 5 (Grizzlies lose)
    { id: `${TOURNAMENT_ID}-pool-b-game-3`, homeScore: 2, awayScore: 5 },
    // Game 4: Crusaders 6, Orcas 1 (Crusaders win)
    { id: `${TOURNAMENT_ID}-pool-b-game-4`, homeScore: 6, awayScore: 1 },
    // Game 5: Grizzlies 8, Orcas 3 (Grizzlies win, now 2-1)
    { id: `${TOURNAMENT_ID}-pool-b-game-5`, homeScore: 8, awayScore: 3 },
    // Game 6: Crusaders 4, Blazers 5 (Crusaders lose, now 2-1 tied with Grizzlies)
    { id: `${TOURNAMENT_ID}-pool-b-game-6`, homeScore: 4, awayScore: 5 },
  ];

  // Pool C: All 4 teams finish 1-2
  // Target: All teams 1-2, sorted by runs allowed
  const poolCUpdates = [
    // Game 1: Stingrays 4, Ninjas 3 (Stingrays win)
    { id: `${TOURNAMENT_ID}-pool-c-game-1`, homeScore: 4, awayScore: 3 },
    // Game 2: Spartans 5, Titans 2 (Spartans win)
    { id: `${TOURNAMENT_ID}-pool-c-game-2`, homeScore: 5, awayScore: 2 },
    // Game 3: Stingrays 2, Spartans 6 (Stingrays: 1-1)
    { id: `${TOURNAMENT_ID}-pool-c-game-3`, homeScore: 2, awayScore: 6 },
    // Game 4: Ninjas 5, Titans 4 (Ninjas: 1-1)
    { id: `${TOURNAMENT_ID}-pool-c-game-4`, homeScore: 5, awayScore: 4 },
    // Game 5: Stingrays 1, Titans 6 (Stingrays: 1-2, RA = 3+6+6 = 15)
    { id: `${TOURNAMENT_ID}-pool-c-game-5`, homeScore: 1, awayScore: 6 },
    // Game 6: Ninjas 3, Spartans 5 (Ninjas: 1-2, all now 1-2)
    { id: `${TOURNAMENT_ID}-pool-c-game-6`, homeScore: 3, awayScore: 5 },
  ];

  const allUpdates = [...poolBUpdates, ...poolCUpdates];

  for (const update of allUpdates) {
    await db.update(games)
      .set({ homeScore: update.homeScore, awayScore: update.awayScore })
      .where(eq(games.id, update.id));
    console.log(`✓ Updated ${update.id}: ${update.homeScore}-${update.awayScore}`);
  }

  console.log(`\n✅ Fixed ${allUpdates.length} games`);
  console.log('\nVerify the new standings in database...');
}

fixTournamentScores()
  .then(() => {
    console.log('\n✅ Success! Scores updated.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
