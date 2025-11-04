import { db } from './server/db';
import { tournaments, ageDivisions, pools, teams, games } from '@shared/schema';
import { nanoid } from 'nanoid';

const OBA_ORG_ID = '6a5b4682-8b33-4058-992d-576b78acb367';

async function createTestTournament() {
  console.log('Creating TEST - 12 Team Top 6 Standard tournament...\n');

  // 1. Create Tournament
  const tournamentId = `test-12-team-top-6-standard-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const [tournament] = await db.insert(tournaments).values({
    id: tournamentId,
    name: 'TEST - 12 Team Top 6 Standard',
    type: 'pool_play',
    organizationId: OBA_ORG_ID,
    numberOfTeams: 12,
    numberOfPools: 3,
    playoffFormat: 'top_6',
    seedingPattern: 'standard',
    startDate: '2025-06-01',
    endDate: '2025-06-03',
    showTiebreakers: true,
    primaryColor: '#22c55e',
    secondaryColor: '#ffffff',
  }).returning();
  
  console.log(`✓ Created tournament: ${tournament.id}`);

  // 2. Create Age Division
  const divisionId = `${tournamentId}-13u`;
  const [division] = await db.insert(ageDivisions).values({
    id: divisionId,
    name: '13U',
    tournamentId: tournament.id,
  }).returning();
  
  console.log(`✓ Created age division: ${division.name}`);

  // 3. Create Pools
  const poolData = [
    { id: `${tournamentId}-pool-a`, name: 'Pool A' },
    { id: `${tournamentId}-pool-b`, name: 'Pool B' },
    { id: `${tournamentId}-pool-c`, name: 'Pool C' },
  ];

  const createdPools = await db.insert(pools).values(
    poolData.map(p => ({
      id: p.id,
      name: p.name,
      tournamentId: tournament.id,
      ageDivisionId: division.id,
    }))
  ).returning();
  
  console.log(`✓ Created ${createdPools.length} pools`);

  // 4. Create Teams
  const teamsData = [
    // Pool A
    { name: 'Toronto Titans', city: 'Toronto', coach: 'Mike Stevens', poolName: 'Pool A' },
    { name: 'Mississauga Mustangs', city: 'Mississauga', coach: 'Sarah Johnson', poolName: 'Pool A' },
    { name: 'Brampton Bulldogs', city: 'Brampton', coach: 'David Chen', poolName: 'Pool A' },
    { name: 'Oakville Owls', city: 'Oakville', coach: 'Jennifer Martin', poolName: 'Pool A' },
    // Pool B
    { name: 'Hamilton Hawks', city: 'Hamilton', coach: 'Robert Brown', poolName: 'Pool B' },
    { name: 'Burlington Bandits', city: 'Burlington', coach: 'Lisa Anderson', poolName: 'Pool B' },
    { name: 'Kitchener Kings', city: 'Kitchener', coach: 'Mark Wilson', poolName: 'Pool B' },
    { name: 'Waterloo Warriors', city: 'Waterloo', coach: 'Emily Davis', poolName: 'Pool B' },
    // Pool C
    { name: 'London Lightning', city: 'London', coach: 'James Thompson', poolName: 'Pool C' },
    { name: 'Windsor Wildcats', city: 'Windsor', coach: 'Michelle Lee', poolName: 'Pool C' },
    { name: 'Ottawa Outlaws', city: 'Ottawa', coach: 'Chris Taylor', poolName: 'Pool C' },
    { name: 'Kingston Knights', city: 'Kingston', coach: 'Amanda White', poolName: 'Pool C' },
  ];

  const createdTeams = await db.insert(teams).values(
    teamsData.map(t => {
      const pool = createdPools.find(p => p.name === t.poolName)!;
      return {
        id: `${tournamentId}-${t.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: t.name,
        city: t.city,
        coach: t.coach,
        division: '13U',
        tournamentId: tournament.id,
        poolId: pool.id,
      };
    })
  ).returning();
  
  console.log(`✓ Created ${createdTeams.length} teams`);

  // 5. Create Pool Play Games with Tie-Breaker Scenarios
  const gamesData = [];
  
  // Helper function to create round-robin games for a pool
  const createPoolGames = (poolTeams: typeof createdTeams, poolName: string, startTime: string) => {
    const poolGames = [];
    const pool = createdPools.find(p => p.name === poolName)!;
    
    // Generate all matchups (6 games for 4 teams)
    const matchups = [
      [0, 1], [2, 3], // Round 1
      [0, 2], [1, 3], // Round 2
      [0, 3], [1, 2], // Round 3
    ];
    
    matchups.forEach((matchup, idx) => {
      const [homeIdx, awayIdx] = matchup;
      const gameDate = idx < 2 ? '2025-06-01' : idx < 4 ? '2025-06-02' : '2025-06-02';
      const hour = parseInt(startTime.split(':')[0]) + Math.floor(idx / 2);
      const minute = (idx % 2) * 30;
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      
      poolGames.push({
        id: `${tournamentId}-${poolName.toLowerCase().replace(' ', '-')}-game-${idx + 1}`,
        homeTeamId: poolTeams[homeIdx].id,
        awayTeamId: poolTeams[awayIdx].id,
        tournamentId: tournament.id,
        poolId: pool.id,
        status: 'completed' as const,
        date: gameDate,
        time: time,
        location: 'Test Tournament Complex, Ontario',
        subVenue: `Field ${poolName.charAt(poolName.length - 1)}${idx + 1}`,
        isPlayoff: false,
        forfeitStatus: 'none' as const,
        homeScore: 0,
        awayScore: 0,
      });
    });
    
    return poolGames;
  };

  // Pool A: 2-way tie for second place (runs allowed tie-breaker)
  // Titans: 3-0, Mustangs: 2-1, Bulldogs: 2-1 (tied, RA decides), Owls: 0-3
  const poolATeams = createdTeams.slice(0, 4);
  const poolAGames = createPoolGames(poolATeams, 'Pool A', '09:00');
  // Game 1: Titans 5, Mustangs 3
  poolAGames[0].homeScore = 5;
  poolAGames[0].awayScore = 3;
  // Game 2: Bulldogs 6, Owls 2
  poolAGames[1].homeScore = 6;
  poolAGames[1].awayScore = 2;
  // Game 3: Titans 7, Bulldogs 4
  poolAGames[2].homeScore = 7;
  poolAGames[2].awayScore = 4;
  // Game 4: Mustangs 8, Owls 1
  poolAGames[3].homeScore = 8;
  poolAGames[3].awayScore = 1;
  // Game 5: Titans 4, Owls 3
  poolAGames[4].homeScore = 4;
  poolAGames[4].awayScore = 3;
  // Game 6: Mustangs 3, Bulldogs 5 (Mustangs: 2-1, 14 RA; Bulldogs: 2-1, 12 RA)
  poolAGames[5].homeScore = 3;
  poolAGames[5].awayScore = 5;
  
  gamesData.push(...poolAGames);

  // Pool B: Clear winner with different records
  // Hawks: 3-0, Bandits: 2-1, Kings: 1-2, Warriors: 0-3
  const poolBTeams = createdTeams.slice(4, 8);
  const poolBGames = createPoolGames(poolBTeams, 'Pool B', '09:00');
  // Game 1: Hawks 6, Bandits 4
  poolBGames[0].homeScore = 6;
  poolBGames[0].awayScore = 4;
  // Game 2: Kings 5, Warriors 3
  poolBGames[1].homeScore = 5;
  poolBGames[1].awayScore = 3;
  // Game 3: Hawks 5, Kings 2
  poolBGames[2].homeScore = 5;
  poolBGames[2].awayScore = 2;
  // Game 4: Bandits 7, Warriors 4
  poolBGames[3].homeScore = 7;
  poolBGames[3].awayScore = 4;
  // Game 5: Hawks 8, Warriors 1
  poolBGames[4].homeScore = 8;
  poolBGames[4].awayScore = 1;
  // Game 6: Bandits 4, Kings 3
  poolBGames[5].homeScore = 4;
  poolBGames[5].awayScore = 3;
  
  gamesData.push(...poolBGames);

  // Pool C: 3-way tie for first place (runs allowed among tied teams)
  // Lightning: 2-1, Wildcats: 2-1, Outlaws: 2-1, Knights: 0-3
  const poolCTeams = createdTeams.slice(8, 12);
  const poolCGames = createPoolGames(poolCTeams, 'Pool C', '09:00');
  // Game 1: Lightning 5, Wildcats 4 (Lightning wins head-to-head)
  poolCGames[0].homeScore = 5;
  poolCGames[0].awayScore = 4;
  // Game 2: Outlaws 7, Knights 2
  poolCGames[1].homeScore = 7;
  poolCGames[1].awayScore = 2;
  // Game 3: Lightning 3, Outlaws 4 (Outlaws wins head-to-head)
  poolCGames[2].homeScore = 3;
  poolCGames[2].awayScore = 4;
  // Game 4: Wildcats 6, Knights 1
  poolCGames[3].homeScore = 6;
  poolCGames[3].awayScore = 1;
  // Game 5: Lightning 8, Knights 3
  poolCGames[4].homeScore = 8;
  poolCGames[4].awayScore = 3;
  // Game 6: Wildcats 2, Outlaws 3 (3-way tie: all 2-1)
  poolCGames[5].homeScore = 2;
  poolCGames[5].awayScore = 3;
  
  gamesData.push(...poolCGames);

  // Insert all games
  const createdGames = await db.insert(games).values(gamesData).returning();
  
  console.log(`✓ Created ${createdGames.length} pool play games`);
  console.log('\n=== Tournament Creation Complete ===');
  console.log(`Tournament ID: ${tournament.id}`);
  console.log(`Total Teams: ${createdTeams.length}`);
  console.log(`Total Games: ${createdGames.length}`);
  console.log('\n=== Pool Standings Preview ===');
  console.log('Pool A: Toronto Titans (3-0), Brampton Bulldogs (2-1), Mississauga Mustangs (2-1), Oakville Owls (0-3)');
  console.log('Pool B: Hamilton Hawks (3-0), Burlington Bandits (2-1), Kitchener Kings (1-2), Waterloo Warriors (0-3)');
  console.log('Pool C: Ottawa Outlaws (2-1), London Lightning (2-1), Windsor Wildcats (2-1), Kingston Knights (0-3)');
  console.log('\nNote: Pool A has a 2-way tie for 2nd (RA tiebreaker)');
  console.log('Note: Pool C has a 3-way tie for 1st (head-to-head RA tiebreaker)');
  console.log('\n=== Use this Tournament ID for validation report testing ===');
  console.log(`TOURNAMENT_ID: ${tournament.id}`);
  
  return tournament.id;
}

createTestTournament()
  .then((tournamentId) => {
    console.log('\n✅ Success! Tournament created:', tournamentId);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error creating tournament:', error);
    process.exit(1);
  });
