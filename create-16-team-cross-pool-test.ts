import { db } from './server/db';
import { tournaments, ageDivisions, pools, teams, games } from '@shared/schema';
import { nanoid } from 'nanoid';

const OBA_ORG_ID = '6a5b4682-8b33-4058-992d-576b78acb367';

async function create16TeamCrossPoolTest() {
  console.log('Creating TEST - 16 Team Top 8 Cross-Pool tournament...\n');

  // 1. Create Tournament
  const tournamentId = `test-16-team-top-8-cross-pool-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const [tournament] = await db.insert(tournaments).values({
    id: tournamentId,
    name: 'TEST - 16 Team Top 8 Cross-Pool',
    type: 'pool_play',
    organizationId: OBA_ORG_ID,
    numberOfTeams: 16,
    numberOfPools: 4,
    playoffFormat: 'top_8',
    seedingPattern: 'cross_pool_4',
    startDate: '2025-09-01',
    endDate: '2025-09-03',
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
    { id: `${tournamentId}-pool-d`, name: 'Pool D' },
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

  // 4. Create Teams (16 NEW Ontario teams)
  const teamsData = [
    // Pool A
    { name: 'Sarnia Sharks', city: 'Sarnia', coach: 'Frank Robinson', poolName: 'Pool A' },
    { name: 'Chatham Chiefs', city: 'Chatham', coach: 'Grace Hamilton', poolName: 'Pool A' },
    { name: 'Leamington Lions', city: 'Leamington', coach: 'Henry Ford', poolName: 'Pool A' },
    { name: 'Amherstburg Avengers', city: 'Amherstburg', coach: 'Irene Johnson', poolName: 'Pool A' },
    // Pool B
    { name: 'Brantford Bisons', city: 'Brantford', coach: 'Jacob Smith', poolName: 'Pool B' },
    { name: 'Paris Panthers', city: 'Paris', coach: 'Kelly Adams', poolName: 'Pool B' },
    { name: 'Simcoe Stallions', city: 'Simcoe', coach: 'Larry Morgan', poolName: 'Pool B' },
    { name: 'Tillsonburg Tigers', city: 'Tillsonburg', coach: 'Nancy Evans', poolName: 'Pool B' },
    // Pool C
    { name: 'Welland Warriors', city: 'Welland', coach: 'Oscar Rivera', poolName: 'Pool C' },
    { name: 'Fort Erie Falcons', city: 'Fort Erie', coach: 'Paula Garcia', poolName: 'Pool C' },
    { name: 'Grimsby Griffins', city: 'Grimsby', coach: 'Quinn Martinez', poolName: 'Pool C' },
    { name: 'Lincoln Lynx', city: 'Lincoln', coach: 'Rita Anderson', poolName: 'Pool C' },
    // Pool D
    { name: 'Orangeville Owls', city: 'Orangeville', coach: 'Samuel Brooks', poolName: 'Pool D' },
    { name: 'Shelburne Sharks', city: 'Shelburne', coach: 'Tina Collins', poolName: 'Pool D' },
    { name: 'Caledon Cardinals', city: 'Caledon', coach: 'Victor Hughes', poolName: 'Pool D' },
    { name: 'Mono Mavericks', city: 'Mono', coach: 'Wendy Foster', poolName: 'Pool D' },
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

  // 5. Create Pool Play Games with unique tie-breaker scenarios
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
      const gameDate = idx < 2 ? '2025-09-01' : idx < 4 ? '2025-09-01' : '2025-09-02';
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
        location: 'Cross-Pool 16-Team Complex, Ontario',
        subVenue: `Field ${poolName.charAt(poolName.length - 1)}${idx + 1}`,
        isPlayoff: false,
        forfeitStatus: 'none' as const,
        homeScore: 0,
        awayScore: 0,
      });
    });
    
    return poolGames;
  };

  // Pool A: 4-way tie - all teams finish 2-1
  // In round-robin with 4 teams, each team plays 3 games, so 2-1 is achievable
  const poolATeams = createdTeams.slice(0, 4);
  const poolAGames = createPoolGames(poolATeams, 'Pool A', '09:00');
  // Create a pattern where each team wins 2 and loses 1
  // Game 1: Sharks 5, Chiefs 3 (Sharks 1-0, Chiefs 0-1)
  poolAGames[0].homeScore = 5;
  poolAGames[0].awayScore = 3;
  // Game 2: Lions 6, Avengers 4 (Lions 1-0, Avengers 0-1)
  poolAGames[1].homeScore = 6;
  poolAGames[1].awayScore = 4;
  // Game 3: Sharks 4, Lions 5 (Sharks 1-1, Lions 2-0)
  poolAGames[2].homeScore = 4;
  poolAGames[2].awayScore = 5;
  // Game 4: Chiefs 7, Avengers 2 (Chiefs 1-1, Avengers 0-2)
  poolAGames[3].homeScore = 7;
  poolAGames[3].awayScore = 2;
  // Game 5: Sharks 6, Avengers 5 (Sharks 2-1, Avengers 1-2)
  poolAGames[4].homeScore = 6;
  poolAGames[4].awayScore = 5;
  // Game 6: Chiefs 4, Lions 3 (Chiefs 2-1, Lions 2-1)
  poolAGames[5].homeScore = 4;
  poolAGames[5].awayScore = 3;
  // Final: All teams 2-1, sorted by runs allowed
  // Sharks: allowed 8 (3+5), Lions: allowed 7 (4+3), Chiefs: allowed 8 (5+3), Avengers: allowed 13 (6+7)
  
  gamesData.push(...poolAGames);

  // Pool B: 2-way tie for last place (3rd vs 4th)
  // Bisons: 3-0, Panthers: 2-1, Stallions: 1-2 (tied), Tigers: 1-2 (tied)
  const poolBTeams = createdTeams.slice(4, 8);
  const poolBGames = createPoolGames(poolBTeams, 'Pool B', '09:30');
  // Game 1: Bisons 8, Panthers 3
  poolBGames[0].homeScore = 8;
  poolBGames[0].awayScore = 3;
  // Game 2: Stallions 5, Tigers 4
  poolBGames[1].homeScore = 5;
  poolBGames[1].awayScore = 4;
  // Game 3: Bisons 7, Stallions 2
  poolBGames[2].homeScore = 7;
  poolBGames[2].awayScore = 2;
  // Game 4: Panthers 6, Tigers 3
  poolBGames[3].homeScore = 6;
  poolBGames[3].awayScore = 3;
  // Game 5: Bisons 5, Tigers 1 (Bisons 3-0)
  poolBGames[4].homeScore = 5;
  poolBGames[4].awayScore = 1;
  // Game 6: Panthers 3, Stallions 4 (Panthers 2-1, both Stallions and Tigers 1-2)
  poolBGames[5].homeScore = 3;
  poolBGames[5].awayScore = 4;
  // Stallions: 1-2 (allowed 13), Tigers: 1-2 (allowed 14)
  
  gamesData.push(...poolBGames);

  // Pool C: One dominant team (3-0), three-way tie for remaining spots
  // Warriors: 3-0, Falcons: 1-2, Griffins: 1-2, Lynx: 1-2
  const poolCTeams = createdTeams.slice(8, 12);
  const poolCGames = createPoolGames(poolCTeams, 'Pool C', '10:00');
  // Game 1: Warriors 9, Falcons 2
  poolCGames[0].homeScore = 9;
  poolCGames[0].awayScore = 2;
  // Game 2: Griffins 5, Lynx 4
  poolCGames[1].homeScore = 5;
  poolCGames[1].awayScore = 4;
  // Game 3: Warriors 8, Griffins 3
  poolCGames[2].homeScore = 8;
  poolCGames[2].awayScore = 3;
  // Game 4: Falcons 7, Lynx 3
  poolCGames[3].homeScore = 7;
  poolCGames[3].awayScore = 3;
  // Game 5: Warriors 6, Lynx 2 (Warriors 3-0)
  poolCGames[4].homeScore = 6;
  poolCGames[4].awayScore = 2;
  // Game 6: Falcons 4, Griffins 5 (all three teams 1-2)
  poolCGames[5].homeScore = 4;
  poolCGames[5].awayScore = 5;
  // Falcons: 1-2 (allowed 18), Griffins: 1-2 (allowed 16), Lynx: 1-2 (allowed 12)
  
  gamesData.push(...poolCGames);

  // Pool D: 2-way tie for first place decided by runs allowed
  // Owls: 2-1 (RA: 11), Sharks: 2-1 (RA: 13), Cardinals: 1-2, Mavericks: 1-2
  const poolDTeams = createdTeams.slice(12, 16);
  const poolDGames = createPoolGames(poolDTeams, 'Pool D', '10:30');
  // Game 1: Owls 7, Sharks 5
  poolDGames[0].homeScore = 7;
  poolDGames[0].awayScore = 5;
  // Game 2: Cardinals 4, Mavericks 3
  poolDGames[1].homeScore = 4;
  poolDGames[1].awayScore = 3;
  // Game 3: Owls 5, Cardinals 3
  poolDGames[2].homeScore = 5;
  poolDGames[2].awayScore = 3;
  // Game 4: Sharks 8, Mavericks 2
  poolDGames[3].homeScore = 8;
  poolDGames[3].awayScore = 2;
  // Game 5: Owls 2, Mavericks 6 (Owls 2-1, allowed 11)
  poolDGames[4].homeScore = 2;
  poolDGames[4].awayScore = 6;
  // Game 6: Sharks 4, Cardinals 8 (Sharks 2-1, allowed 13)
  poolDGames[5].homeScore = 4;
  poolDGames[5].awayScore = 8;
  
  gamesData.push(...poolDGames);

  // Insert all games
  const createdGames = await db.insert(games).values(gamesData).returning();
  
  console.log(`✓ Created ${createdGames.length} pool play games`);
  console.log('\n=== Tournament Creation Complete ===');
  console.log(`Tournament ID: ${tournament.id}`);
  console.log(`Total Teams: ${createdTeams.length}`);
  console.log(`Total Games: ${createdGames.length}`);
  console.log(`Playoff Format: ${tournament.playoffFormat}`);
  console.log(`Seeding Pattern: ${tournament.seedingPattern}`);
  console.log('\n=== Pool Standings Preview ===');
  console.log('Pool A (4-way tie - all teams 2-1):');
  console.log('  1. Leamington Lions (2-1, RA: 7)');
  console.log('  2. Sarnia Sharks (2-1, RA: 8)');
  console.log('  3. Chatham Chiefs (2-1, RA: 8)');
  console.log('  4. Amherstburg Avengers (2-1, RA: 13)');
  console.log('\nPool B (2-way tie for last place):');
  console.log('  1. Brantford Bisons (3-0)');
  console.log('  2. Paris Panthers (2-1)');
  console.log('  3. Simcoe Stallions (1-2, RA: 13) *tied for 3rd*');
  console.log('  4. Tillsonburg Tigers (1-2, RA: 14) *tied for 3rd*');
  console.log('\nPool C (One dominant, three-way tie for 2nd-4th):');
  console.log('  1. Welland Warriors (3-0)');
  console.log('  2. Lincoln Lynx (1-2, RA: 12) *tied*');
  console.log('  3. Grimsby Griffins (1-2, RA: 16) *tied*');
  console.log('  4. Fort Erie Falcons (1-2, RA: 18) *tied*');
  console.log('\nPool D (2-way tie for first place):');
  console.log('  1. Orangeville Owls (2-1, RA: 11) *tied for 1st*');
  console.log('  2. Shelburne Sharks (2-1, RA: 13) *tied for 1st*');
  console.log('  3. Caledon Cardinals (1-2)');
  console.log('  4. Mono Mavericks (1-2)');
  console.log('\n=== Tie-Breaker Scenarios ===');
  console.log('Pool A: 4-way tie - ALL teams finish 2-1');
  console.log('Pool B: 2-way tie for LAST place (3rd vs 4th)');
  console.log('Pool C: One dominant team (3-0), three-way tie for remaining spots');
  console.log('Pool D: 2-way tie for FIRST place decided by runs allowed');
  console.log('\n=== Use this Tournament ID for validation report testing ===');
  console.log(`TOURNAMENT_ID: ${tournament.id}`);
  console.log('\n✅ This is the FINAL test tournament with cross_pool_4 seeding pattern for Top 8 playoffs.');
  console.log('Expected playoff matchups (cross_pool_4):');
  console.log('  - A1 (Lions) vs C2 (Lynx)');
  console.log('  - D1 (Owls) vs B2 (Panthers)');
  console.log('  - A2 (Sharks) vs C1 (Warriors)');
  console.log('  - D2 (Sharks-Shelburne) vs B1 (Bisons)');
  
  return tournament.id;
}

create16TeamCrossPoolTest()
  .then((tournamentId) => {
    console.log('\n✅ Success! 16-Team Cross-Pool Test Tournament created:', tournamentId);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error creating tournament:', error);
    process.exit(1);
  });
