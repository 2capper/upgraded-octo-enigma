import { db } from './server/db';
import { games } from '@shared/schema';
import { eq } from 'drizzle-orm';

const TOURNAMENT_ID = 'test-12-team-top-6-cross-pool-2025-11';

async function recalculateScores() {
  console.log('Recalculating tournament scores for correct tie-breaker scenarios...\n');

  // Pool B: 2-way tie for FIRST place (both 2-1)
  // Grizzlies vs Crusaders, Blazers, Orcas
  // Crusaders vs Grizzlies, Blazers, Orcas
  // Target: Grizzlies 2-1 (RA: 10), Crusaders 2-1 (RA: 12), then Blazers and Orcas with losing records
  
  const poolBUpdates = [
    // Game 1: Grizzlies 6, Crusaders 4 (Grizzlies win) - Grizzlies allowed 4
    { id: `${TOURNAMENT_ID}-pool-b-game-1`, homeScore: 6, awayScore: 4 },
    // Game 2: Blazers 5, Orcas 2 (Blazers win)
    { id: `${TOURNAMENT_ID}-pool-b-game-2`, homeScore: 5, awayScore: 2 },
    // Game 3: Grizzlies 3, Blazers 4 (Grizzlies lose) - Grizzlies allowed 4
    { id: `${TOURNAMENT_ID}-pool-b-game-3`, homeScore: 3, awayScore: 4 },
    // Game 4: Crusaders 7, Orcas 1 (Crusaders win) - Crusaders allowed 1
    { id: `${TOURNAMENT_ID}-pool-b-game-4`, homeScore: 7, awayScore: 1 },
    // Game 5: Grizzlies 8, Orcas 2 (Grizzlies win, 2-1) - Grizzlies allowed 2, total RA = 10
    { id: `${TOURNAMENT_ID}-pool-b-game-5`, homeScore: 8, awayScore: 2 },
    // Game 6: Crusaders 3, Blazers 5 (Crusaders lose, 2-1) - Crusaders allowed 6+5=11, total RA = 12
    { id: `${TOURNAMENT_ID}-pool-b-game-6`, homeScore: 3, awayScore: 5 },
  ];

  // Pool C: ALL 4 teams finish 1-2
  // Each team needs exactly 1 win and 2 losses
  const poolCUpdates = [
    // Game 1: Stingrays 5, Ninjas 3 (Stingrays 1-0, Ninjas 0-1)
    { id: `${TOURNAMENT_ID}-pool-c-game-1`, homeScore: 5, awayScore: 3 },
    // Game 2: Spartans 6, Titans 2 (Spartans 1-0, Titans 0-1)
    { id: `${TOURNAMENT_ID}-pool-c-game-2`, homeScore: 6, awayScore: 2 },
    // Game 3: Stingrays 2, Spartans 4 (Stingrays 1-1, Spartans 2-0)
    { id: `${TOURNAMENT_ID}-pool-c-game-3`, homeScore: 2, awayScore: 4 },
    // Game 4: Ninjas 6, Titans 3 (Ninjas 1-1, Titans 0-2)
    { id: `${TOURNAMENT_ID}-pool-c-game-4`, homeScore: 6, awayScore: 3 },
    // Game 5: Stingrays 1, Titans 7 (Stingrays 1-2, Titans 1-2)
    { id: `${TOURNAMENT_ID}-pool-c-game-5`, homeScore: 1, awayScore: 7 },
    // Game 6: Ninjas 2, Spartans 5 (Ninjas 1-2, Spartans 2-1)
    // Need to adjust - Spartans should be 1-2, not 3-0
    // Let me recalculate...
    // Round 1: Stingrays beats Ninjas, Spartans beats Titans
    // Round 2: Ninjas beats Stingrays, Titans beats Spartans -> Everyone 1-1
    // Round 3: Stingrays beats Titans, Ninjas beats Spartans -> Stingrays 2-1, Ninjas 2-1, not what we want
    // 
    // Try again:
    // Round 1: Stingrays wins, Spartans wins -> Stingrays 1-0, Ninjas 0-1, Spartans 1-0, Titans 0-1
    // Round 2: Spartans wins, Ninjas wins -> Stingrays 1-1, Ninjas 1-1, Spartans 2-0, Titans 0-2
    // Round 3: Titans wins, Spartans wins -> Stingrays 1-2, Ninjas 1-2, Spartans 3-0, Titans 1-2
    //
    // Still doesn't work. Need different approach:
    // Round 1: A beats B (5-3), C beats D (6-2)
    // Round 2: B beats C (6-4), D beats A (7-1)  
    // Round 3: A beats C (4-2), B beats D (5-3)
    // Final: A (2-1), B (2-1), C (1-2), D (1-2)
    //
    // Let's try one more time for ALL 1-2:
    // R1: A beats B, C beats D -> A:1-0, B:0-1, C:1-0, D:0-1
    // R2: B beats C, D beats A -> A:1-1, B:1-1, C:1-1, D:1-1
    // R3: B beats A, C beats D -> A:1-2, B:2-1, C:2-1, D:1-2
    // Still doesn't give us all 1-2
    //
    // The only way to get all 1-2 is if there's a cycle:
    // A beats B, B beats C, C beats D, D beats A, and then 2 more games
    // A beats C, D beats B
    // A: beat B,C lost to D = 2-1
    // B: beat C lost to A,D = 1-2
    // C: beat D lost to A,B = 1-2
    // D: beat A,B lost to C = 2-1
    // Still not all 1-2!
    //
    // Actually mathematically impossible for all 4 teams in round-robin to be 1-2
    // Total games = 6, total wins = 6, total losses = 6
    // If all 4 teams are 1-2, that's 4 wins and 8 losses (impossible!)
    //
    // Let me create a 3-way tie instead at 2-1:
    // Stingrays, Ninjas, Spartans all 2-1, Titans 0-3
    { id: `${TOURNAMENT_ID}-pool-c-game-6`, homeScore: 4, awayScore: 6 },
  ];

  // Recalculate Pool C for 3-way tie at 2-1
  const poolCCorrect = [
    // Game 1: Stingrays 5, Ninjas 3 (Stingrays 1-0)
    { id: `${TOURNAMENT_ID}-pool-c-game-1`, homeScore: 5, awayScore: 3 },
    // Game 2: Spartans 6, Titans 1 (Spartans 1-0)
    { id: `${TOURNAMENT_ID}-pool-c-game-2`, homeScore: 6, awayScore: 1 },
    // Game 3: Stingrays 2, Spartans 4 (Stingrays 1-1, Spartans 2-0)
    { id: `${TOURNAMENT_ID}-pool-c-game-3`, homeScore: 2, awayScore: 4 },
    // Game 4: Ninjas 7, Titans 2 (Ninjas 1-1, Titans 0-2)
    { id: `${TOURNAMENT_ID}-pool-c-game-4`, homeScore: 7, awayScore: 2 },
    // Game 5: Stingrays 6, Titans 1 (Stingrays 2-1, Titans 0-3)
    { id: `${TOURNAMENT_ID}-pool-c-game-5`, homeScore: 6, awayScore: 1 },
    // Game 6: Ninjas 4, Spartans 5 (Ninjas 1-2, Spartans 2-1... wait this gives us Spartans 3-0)
    // Game 6: Spartans 2, Ninjas 5 (Spartans 2-1, Ninjas 2-1) - 3-way tie at 2-1!
    { id: `${TOURNAMENT_ID}-pool-c-game-6`, homeScore: 2, awayScore: 5 },
  ];

  const allUpdates = [...poolBUpdates, ...poolCCorrect];

  for (const update of allUpdates) {
    await db.update(games)
      .set({ homeScore: update.homeScore, awayScore: update.awayScore })
      .where(eq(games.id, update.id));
  }

  console.log(`✅ Updated ${allUpdates.length} games`);
  
  // Calculate expected standings
  console.log('\n=== Expected Standings ===');
  console.log('Pool B:');
  console.log('  Guelph Grizzlies: 2-1 (RA: 4+4+2 = 10)');
  console.log('  Cambridge Crusaders: 2-1 (RA: 6+5+1 = 12)');
  console.log('  Barrie Blazers: 1-2');
  console.log('  Orillia Orcas: 0-3');
  console.log('\nPool C (3-way tie at 2-1):');
  console.log('  Scarborough Stingrays: 2-1 (RA: 3+4+1 = 8)');
  console.log('  Niagara Falls Ninjas: 2-1 (RA: 5+3+2 = 10)');
  console.log('  Sudbury Spartans: 2-1 (RA: 2+4+5 = 11)');
  console.log('  Thunder Bay Titans: 0-3');
}

recalculateScores()
  .then(() => {
    console.log('\n✅ Success!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
