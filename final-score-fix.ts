import { db } from './server/db';
import { games } from '@shared/schema';
import { eq } from 'drizzle-orm';

const TOURNAMENT_ID = 'test-12-team-top-6-cross-pool-2025-11';

async function finalScoreFix() {
  console.log('Final score fix for proper tie-breaker scenarios...\n');

  // Pool B games - Need 2-way tie for FIRST (both 2-1)
  // Teams: Grizzlies, Crusaders, Blazers, Orcas
  // Game 1: Grizzlies vs Crusaders
  // Game 2: Blazers vs Orcas
  // Game 3: Grizzlies vs Blazers
  // Game 4: Crusaders vs Orcas
  // Game 5: Grizzlies vs Orcas
  // Game 6: Crusaders vs Blazers
  
  // To get Grizzlies 2-1 and Crusaders 2-1:
  // Grizzlies: beat Crusaders, beat Orcas, lose to Blazers = 2-1
  // Crusaders: lose to Grizzlies, beat Orcas, beat Blazers = 2-1
  // Blazers: lose to Orcas, beat Grizzlies, lose to Crusaders = 1-2
  // Orcas: beat Blazers, lose to Grizzlies, lose to Crusaders = 1-2
  
  await db.update(games).set({ homeScore: 6, awayScore: 4 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-b-game-1`)); // Grizzlies 6, Crusaders 4
  await db.update(games).set({ homeScore: 3, awayScore: 5 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-b-game-2`)); // Blazers 3, Orcas 5
  await db.update(games).set({ homeScore: 2, awayScore: 4 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-b-game-3`)); // Grizzlies 2, Blazers 4
  await db.update(games).set({ homeScore: 7, awayScore: 2 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-b-game-4`)); // Crusaders 7, Orcas 2
  await db.update(games).set({ homeScore: 8, awayScore: 3 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-b-game-5`)); // Grizzlies 8, Orcas 3
  await db.update(games).set({ homeScore: 6, awayScore: 3 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-b-game-6`)); // Crusaders 6, Blazers 3

  console.log('✓ Fixed Pool B games');
  console.log('Expected: Grizzlies 2-1 (RA: 4+4+3=11), Crusaders 2-1 (RA: 6+3+2=11), Blazers 1-2, Orcas 1-2');

  // Pool C games - ALL 4 teams finish 1-2
  // Actually this is mathematically IMPOSSIBLE in round-robin (6 games total = 6 wins, 6 losses)
  // If all 4 are 1-2, that would be 4 wins and 8 losses (impossible)
  // 
  // Let me create a 3-way tie at 2-1 instead (which IS mathematically possible):
  // 3 teams at 2-1 = 6 wins, 3 losses
  // 1 team at 0-3 = 0 wins, 3 losses
  // Total: 6 wins, 6 losses ✓
  
  // Teams: Stingrays, Ninjas, Spartans, Titans
  // Stingrays: beat Ninjas, beat Titans, lose to Spartans = 2-1
  // Ninjas: lose to Stingrays, beat Spartans, beat Titans = 2-1
  // Spartans: beat Stingrays, lose to Ninjas, beat Titans = 2-1
  // Titans: lose to all = 0-3
  
  await db.update(games).set({ homeScore: 5, awayScore: 3 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-c-game-1`)); // Stingrays 5, Ninjas 3
  await db.update(games).set({ homeScore: 6, awayScore: 1 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-c-game-2`)); // Spartans 6, Titans 1
  await db.update(games).set({ homeScore: 2, awayScore: 4 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-c-game-3`)); // Stingrays 2, Spartans 4
  await db.update(games).set({ homeScore: 7, awayScore: 2 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-c-game-4`)); // Ninjas 7, Titans 2
  await db.update(games).set({ homeScore: 6, awayScore: 1 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-c-game-5`)); // Stingrays 6, Titans 1
  await db.update(games).set({ homeScore: 5, awayScore: 2 })
    .where(eq(games.id, `${TOURNAMENT_ID}-pool-c-game-6`)); // Ninjas 5, Spartans 2

  console.log('✓ Fixed Pool C games');
  console.log('Expected: Stingrays 2-1 (RA: 3+4+1=8), Ninjas 2-1 (RA: 5+2+1=8 tied!), Spartans 2-1 (RA: 2+5+6=13), Titans 0-3');
  
  console.log('\n✅ All scores fixed!');
  console.log('\nNote: Pool C has 3-way tie at 2-1 (not 4-way at 1-2, which is mathematically impossible)');
}

finalScoreFix()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
