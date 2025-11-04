import { db } from './server/db';
import { tournaments, pools, teams, games } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { calculateStandings } from '@shared/standingsCalculation';

async function verifyStandings() {
  const tournamentId = 'test-12-team-top-6-standard-2025-11';
  
  console.log('Verifying tournament standings...\n');
  
  // Fetch tournament data
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  const tournamentPools = await db.select().from(pools).where(eq(pools.tournamentId, tournamentId));
  const tournamentTeams = await db.select().from(teams).where(eq(teams.tournamentId, tournamentId));
  const tournamentGames = await db.select().from(games).where(eq(games.tournamentId, tournamentId));
  
  console.log(`Tournament: ${tournament.name}`);
  console.log(`Pools: ${tournamentPools.length}`);
  console.log(`Teams: ${tournamentTeams.length}`);
  console.log(`Games: ${tournamentGames.length}\n`);
  
  // Calculate standings for each pool
  for (const pool of tournamentPools) {
    const poolTeams = tournamentTeams.filter(t => t.poolId === pool.id);
    const poolGames = tournamentGames.filter(g => g.poolId === pool.id);
    
    const standings = calculateStandings(poolTeams, poolGames, tournament.showTiebreakers);
    
    console.log(`=== ${pool.name} Standings ===`);
    standings.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}`);
      console.log(`   Record: ${team.wins}-${team.losses} | RF: ${team.runsScored} | RA: ${team.runsAllowed}`);
      if (team.tiebreakers && team.tiebreakers.length > 0) {
        console.log(`   Tie-breakers: ${team.tiebreakers.join(', ')}`);
      }
    });
    console.log('');
  }
  
  // Calculate overall top 6 seeding
  console.log('=== Top 6 Playoff Seeds ===');
  const allStandings = tournamentPools.flatMap(pool => {
    const poolTeams = tournamentTeams.filter(t => t.poolId === pool.id);
    const poolGames = tournamentGames.filter(g => g.poolId === pool.id);
    return calculateStandings(poolTeams, poolGames, tournament.showTiebreakers);
  });
  
  // Get pool winners (first place from each pool)
  const poolWinners = tournamentPools.map(pool => {
    const poolTeams = tournamentTeams.filter(t => t.poolId === pool.id);
    const poolGames = tournamentGames.filter(g => g.poolId === pool.id);
    const standings = calculateStandings(poolTeams, poolGames, tournament.showTiebreakers);
    return { ...standings[0], pool: pool.name };
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return (b.runsScored - b.runsAllowed) - (a.runsScored - a.runsAllowed);
  });
  
  // Get pool runners-up (second place from each pool)
  const poolRunnersUp = tournamentPools.map(pool => {
    const poolTeams = tournamentTeams.filter(t => t.poolId === pool.id);
    const poolGames = tournamentGames.filter(g => g.poolId === pool.id);
    const standings = calculateStandings(poolTeams, poolGames, tournament.showTiebreakers);
    return { ...standings[1], pool: pool.name };
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.runsAllowed - b.runsAllowed;
  });
  
  const top6 = [...poolWinners, ...poolRunnersUp];
  
  top6.forEach((team, index) => {
    console.log(`Seed ${index + 1}: ${team.name} (${team.pool})`);
    console.log(`   Record: ${team.wins}-${team.losses} | RF: ${team.runsScored} | RA: ${team.runsAllowed}`);
  });
  
  console.log('\n✅ Standings verification complete!');
}

verifyStandings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
