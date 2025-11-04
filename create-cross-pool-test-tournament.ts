import { db } from './server/db';
import { tournaments, ageDivisions, pools, teams, games } from '@shared/schema';
import { nanoid } from 'nanoid';

const OBA_ORG_ID = '6a5b4682-8b33-4058-992d-576b78acb367';

async function createCrossPoolTestTournament() {
  console.log('Creating TEST - 12 Team Top 6 Cross-Pool tournament...\n');

  // 1. Create Tournament
  const tournamentId = `test-12-team-top-6-cross-pool-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const [tournament] = await db.insert(tournaments).values({
    id: tournamentId,
    name: 'TEST - 12 Team Top 6 Cross-Pool',
    type: 'pool_play',
    organizationId: OBA_ORG_ID,
    numberOfTeams: 12,
    numberOfPools: 3,
    playoffFormat: 'top_6',
    seedingPattern: 'cross_pool_3',
    startDate: '2025-07-01',
    endDate: '2025-07-03',
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

  // 4. Create Teams (NEW teams, different from the first test tournament)
  const teamsData = [
    // Pool A
    { name: 'Scarborough Storm', city: 'Scarborough', coach: 'Tony Martinez', poolName: 'Pool A' },
    { name: 'Etobicoke Eagles', city: 'Etobicoke', coach: 'Karen Singh', poolName: 'Pool A' },
    { name: 'Vaughan Vipers', city: 'Vaughan', coach: 'Peter Romano', poolName: 'Pool A' },
    { name: 'Markham Mavericks', city: 'Markham', coach: 'Susan Park', poolName: 'Pool A' },
    // Pool B
    { name: 'Guelph Grizzlies', city: 'Guelph', coach: "Brian O'Connor", poolName: 'Pool B' },
    { name: 'Cambridge Crusaders', city: 'Cambridge', coach: 'Rachel Green', poolName: 'Pool B' },
    { name: 'Barrie Blazers', city: 'Barrie', coach: 'Kevin Murphy', poolName: 'Pool B' },
    { name: 'Orillia Orcas', city: 'Orillia', coach: 'Diana Ross', poolName: 'Pool B' },
    // Pool C
    { name: 'St. Catharines Stingrays', city: 'St. Catharines', coach: 'Paul Jackson', poolName: 'Pool C' },
    { name: 'Niagara Falls Ninjas', city: 'Niagara Falls', coach: 'Marie Dubois', poolName: 'Pool C' },
    { name: 'Sudbury Spartans', city: 'Sudbury', coach: 'John MacDonald', poolName: 'Pool C' },
    { name: 'Thunder Bay Titans', city: 'Thunder Bay', coach: 'Lisa Fontaine', poolName: 'Pool C' },
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

  // 5. Create Pool Play Games with DIFFERENT Tie-Breaker Scenarios
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
      const gameDate = idx < 2 ? '2025-07-01' : idx < 4 ? '2025-07-01' : '2025-07-02';
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
        location: 'Cross-Pool Test Complex, Ontario',
        subVenue: `Field ${poolName.charAt(poolName.length - 1)}${idx + 1}`,
        isPlayoff: false,
        forfeitStatus: 'none' as const,
        homeScore: 0,
        awayScore: 0,
      });
    });
    
    return poolGames;
  };

  // Pool A: Clear winner, no ties
  // Storm: 3-0, Eagles: 2-1, Vipers: 1-2, Mavericks: 0-3
  const poolATeams = createdTeams.slice(0, 4);
  const poolAGames = createPoolGames(poolATeams, 'Pool A', '09:00');
  // Game 1: Storm 7, Eagles 4
  poolAGames[0].homeScore = 7;
  poolAGames[0].awayScore = 4;
  // Game 2: Vipers 5, Mavericks 3
  poolAGames[1].homeScore = 5;
  poolAGames[1].awayScore = 3;
  // Game 3: Storm 6, Vipers 2
  poolAGames[2].homeScore = 6;
  poolAGames[2].awayScore = 2;
  // Game 4: Eagles 8, Mavericks 1
  poolAGames[3].homeScore = 8;
  poolAGames[3].awayScore = 1;
  // Game 5: Storm 9, Mavericks 2
  poolAGames[4].homeScore = 9;
  poolAGames[4].awayScore = 2;
  // Game 6: Eagles 4, Vipers 3
  poolAGames[5].homeScore = 4;
  poolAGames[5].awayScore = 3;
  
  gamesData.push(...poolAGames);

  // Pool B: 2-way tie for first place (runs allowed tie-breaker needed)
  // Grizzlies: 2-1 (RA: 10), Crusaders: 2-1 (RA: 12), Blazers: 1-2, Orcas: 1-2
  const poolBTeams = createdTeams.slice(4, 8);
  const poolBGames = createPoolGames(poolBTeams, 'Pool B', '09:30');
  // Game 1: Grizzlies 6, Crusaders 4 (Grizzlies win head-to-head)
  poolBGames[0].homeScore = 6;
  poolBGames[0].awayScore = 4;
  // Game 2: Blazers 5, Orcas 3
  poolBGames[1].homeScore = 5;
  poolBGames[1].awayScore = 3;
  // Game 3: Grizzlies 3, Blazers 4 (Grizzlies lose)
  poolBGames[2].homeScore = 3;
  poolBGames[2].awayScore = 4;
  // Game 4: Crusaders 7, Orcas 2
  poolBGames[3].homeScore = 7;
  poolBGames[3].awayScore = 2;
  // Game 5: Grizzlies 7, Orcas 3 (Grizzlies: 2-1, allowed 10 runs)
  poolBGames[4].homeScore = 7;
  poolBGames[4].awayScore = 3;
  // Game 6: Crusaders 3, Blazers 6 (Crusaders: 2-1, allowed 12 runs)
  poolBGames[5].homeScore = 3;
  poolBGames[5].awayScore = 6;
  
  gamesData.push(...poolBGames);

  // Pool C: All 4 teams finish 1-2 (complex multi-team tie scenario using runs allowed among tied teams)
  // Stingrays: 1-2 (RA: 10), Ninjas: 1-2 (RA: 11), Spartans: 1-2 (RA: 12), Titans: 1-2 (RA: 13)
  const poolCTeams = createdTeams.slice(8, 12);
  const poolCGames = createPoolGames(poolCTeams, 'Pool C', '10:00');
  // Game 1: Stingrays 5, Ninjas 4 (Stingrays win)
  poolCGames[0].homeScore = 5;
  poolCGames[0].awayScore = 4;
  // Game 2: Spartans 6, Titans 3 (Spartans win)
  poolCGames[1].homeScore = 6;
  poolCGames[1].awayScore = 3;
  // Game 3: Stingrays 2, Spartans 5 (Stingrays: 1-1, allowed 5)
  poolCGames[2].homeScore = 2;
  poolCGames[2].awayScore = 5;
  // Game 4: Ninjas 7, Titans 4 (Ninjas: 1-1, allowed 4)
  poolCGames[3].homeScore = 7;
  poolCGames[3].awayScore = 4;
  // Game 5: Stingrays 3, Titans 8 (Stingrays: 1-2, allowed 10 total)
  poolCGames[4].homeScore = 3;
  poolCGames[4].awayScore = 8;
  // Game 6: Ninjas 4, Spartans 7 (all finish 1-2)
  // Final RA: Stingrays 10, Ninjas 11, Spartans 12, Titans 13
  poolCGames[5].homeScore = 4;
  poolCGames[5].awayScore = 7;
  
  gamesData.push(...poolCGames);

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
  console.log('Pool A (Clear winner):');
  console.log('  1. Scarborough Storm (3-0)');
  console.log('  2. Etobicoke Eagles (2-1)');
  console.log('  3. Vaughan Vipers (1-2)');
  console.log('  4. Markham Mavericks (0-3)');
  console.log('\nPool B (2-way tie for first):');
  console.log('  1. Guelph Grizzlies (2-1, RA: 10) *tied*');
  console.log('  2. Cambridge Crusaders (2-1, RA: 12) *tied*');
  console.log('  3. Barrie Blazers (1-2)');
  console.log('  4. Orillia Orcas (1-2)');
  console.log('\nPool C (4-way tie - all teams 1-2):');
  console.log('  1. St. Catharines Stingrays (1-2, RA: 10)');
  console.log('  2. Niagara Falls Ninjas (1-2, RA: 11)');
  console.log('  3. Sudbury Spartans (1-2, RA: 12)');
  console.log('  4. Thunder Bay Titans (1-2, RA: 13)');
  console.log('\n=== Tie-Breaker Scenarios ===');
  console.log('Pool A: NO TIES - Clear winner');
  console.log('Pool B: 2-way tie for FIRST place (runs allowed tie-breaker)');
  console.log('Pool C: 4-way tie (complex multi-team tie using runs allowed)');
  console.log('\n=== Use this Tournament ID for validation report testing ===');
  console.log(`TOURNAMENT_ID: ${tournament.id}`);
  console.log('\nThis tournament tests the cross_pool_3 seeding pattern for Top 6 playoffs.');
  
  return tournament.id;
}

createCrossPoolTestTournament()
  .then((tournamentId) => {
    console.log('\n✅ Success! Cross-Pool Test Tournament created:', tournamentId);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error creating tournament:', error);
    process.exit(1);
  });
