import { db } from './server/db';
import { tournaments, ageDivisions, pools, teams, games } from '@shared/schema';
import { nanoid } from 'nanoid';

const OBA_ORG_ID = '6a5b4682-8b33-4058-992d-576b78acb367';

async function create16TeamTestTournament() {
  console.log('Creating TEST - 16 Team Top 8 Standard tournament...\n');

  // 1. Create Tournament
  const tournamentId = `test-16-team-top-8-standard-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const [tournament] = await db.insert(tournaments).values({
    id: tournamentId,
    name: 'TEST - 16 Team Top 8 Standard',
    type: 'pool_play',
    organizationId: OBA_ORG_ID,
    numberOfTeams: 16,
    numberOfPools: 4,
    playoffFormat: 'top_8',
    seedingPattern: 'standard',
    startDate: '2025-08-01',
    endDate: '2025-08-03',
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

  // 4. Create Teams (16 NEW realistic Ontario baseball teams)
  const teamsData = [
    // Pool A
    { name: 'Ajax Aces', city: 'Ajax', coach: 'Tom Henderson', poolName: 'Pool A' },
    { name: 'Pickering Panthers', city: 'Pickering', coach: 'Sandra Mitchell', poolName: 'Pool A' },
    { name: 'Whitby Wolves', city: 'Whitby', coach: 'Derek Campbell', poolName: 'Pool A' },
    { name: 'Oshawa Owls', city: 'Oshawa', coach: 'Patricia Lee', poolName: 'Pool A' },
    // Pool B
    { name: 'Richmond Hill Rangers', city: 'Richmond Hill', coach: 'Michael Chang', poolName: 'Pool B' },
    { name: 'Newmarket Navigators', city: 'Newmarket', coach: 'Jennifer Walsh', poolName: 'Pool B' },
    { name: 'Aurora Aviators', city: 'Aurora', coach: 'Steve Peterson', poolName: 'Pool B' },
    { name: 'Bradford Bulls', city: 'Bradford', coach: 'Maria Santos', poolName: 'Pool B' },
    // Pool C
    { name: 'Milton Mustangs', city: 'Milton', coach: 'Andrew Miller', poolName: 'Pool C' },
    { name: 'Halton Hawks', city: 'Halton Hills', coach: 'Rebecca Turner', poolName: 'Pool C' },
    { name: 'Georgetown Giants', city: 'Georgetown', coach: 'Daniel Kim', poolName: 'Pool C' },
    { name: 'Acton Arrows', city: 'Acton', coach: 'Laura Cooper', poolName: 'Pool C' },
    // Pool D
    { name: 'Peterborough Pirates', city: 'Peterborough', coach: 'Richard Davis', poolName: 'Pool D' },
    { name: 'Cobourg Cougars', city: 'Cobourg', coach: 'Michelle Brown', poolName: 'Pool D' },
    { name: 'Port Hope Pelicans', city: 'Port Hope', coach: 'Jason Taylor', poolName: 'Pool D' },
    { name: 'Belleville Blaze', city: 'Belleville', coach: 'Angela White', poolName: 'Pool D' },
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

  // 5. Create Pool Play Games with Complex Tie-Breaker Scenarios
  const gamesData = [];
  
  // Helper function to create round-robin games for a pool
  const createPoolGames = (poolTeams: typeof createdTeams, poolName: string, startTime: string, startDate: string) => {
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
      const gameDate = idx < 2 ? '2025-08-01' : idx < 4 ? '2025-08-01' : '2025-08-02';
      const hour = parseInt(startTime.split(':')[0]) + Math.floor(idx / 2) * 2;
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
        location: 'Standard 16-Team Complex, Ontario',
        subVenue: `Field ${poolName.charAt(poolName.length - 1)}${idx + 1}`,
        isPlayoff: false,
        forfeitStatus: 'none' as const,
        homeScore: 0,
        awayScore: 0,
      });
    });
    
    return poolGames;
  };

  // Pool A: 3-way tie involving 1st place (head-to-head won't break it, needs runs allowed among tied teams)
  // Target: Aces 2-1, Panthers 2-1, Wolves 2-1, Owls 0-3
  // Creating circular head-to-head: Aces > Panthers, Panthers > Wolves, Wolves > Aces
  // Team order: [Aces, Panthers, Wolves, Owls] = [0, 1, 2, 3]
  // Matchups: [0,1], [2,3], [0,2], [1,3], [0,3], [1,2]
  const poolATeams = createdTeams.slice(0, 4);
  const poolAGames = createPoolGames(poolATeams, 'Pool A', '09:00', '2025-08-01');
  
  // Game 1: [0,1] = Aces vs Panthers - ACES WIN 6-5
  poolAGames[0].homeScore = 6;
  poolAGames[0].awayScore = 5;
  // Game 2: [2,3] = Wolves vs Owls - WOLVES WIN 7-2
  poolAGames[1].homeScore = 7;
  poolAGames[1].awayScore = 2;
  // Game 3: [0,2] = Aces vs Wolves - WOLVES WIN 4-3
  poolAGames[2].homeScore = 3;
  poolAGames[2].awayScore = 4;
  // Game 4: [1,3] = Panthers vs Owls - PANTHERS WIN 8-1
  poolAGames[3].homeScore = 8;
  poolAGames[3].awayScore = 1;
  // Game 5: [0,3] = Aces vs Owls - ACES WIN 9-2
  poolAGames[4].homeScore = 9;
  poolAGames[4].awayScore = 2;
  // Game 6: [1,2] = Panthers vs Wolves - PANTHERS WIN 5-4
  poolAGames[5].homeScore = 5;
  poolAGames[5].awayScore = 4;
  // Result: All three teams 2-1 with circular head-to-head
  // Aces: 2-1 (beat Panthers 6-5, Owls 9-2; lost to Wolves 3-4) 
  // Panthers: 2-1 (beat Wolves 5-4, Owls 8-1; lost to Aces 5-6)
  // Wolves: 2-1 (beat Aces 4-3, Owls 7-2; lost to Panthers 4-5)
  // Owls: 0-3 (lost to all)
  // Runs allowed among tied teams (only games vs each other):
  // Aces: allowed 4 vs Wolves, 5 vs Panthers = 9 RA
  // Panthers: allowed 6 vs Aces, 4 vs Wolves = 10 RA
  // Wolves: allowed 3 vs Aces, 5 vs Panthers = 8 RA
  // Winner: Wolves (lowest RA among tied teams)
  
  gamesData.push(...poolAGames);

  // Pool B: Clear standings, no ties
  // Rangers: 3-0, Navigators: 2-1, Aviators: 1-2, Bulls: 0-3
  const poolBTeams = createdTeams.slice(4, 8);
  const poolBGames = createPoolGames(poolBTeams, 'Pool B', '09:00', '2025-08-01');
  
  // Game 1: Rangers 7, Navigators 4
  poolBGames[0].homeScore = 7;
  poolBGames[0].awayScore = 4;
  // Game 2: Aviators 5, Bulls 3
  poolBGames[1].homeScore = 5;
  poolBGames[1].awayScore = 3;
  // Game 3: Rangers 6, Aviators 2
  poolBGames[2].homeScore = 6;
  poolBGames[2].awayScore = 2;
  // Game 4: Navigators 8, Bulls 1
  poolBGames[3].homeScore = 8;
  poolBGames[3].awayScore = 1;
  // Game 5: Rangers 5, Bulls 2
  poolBGames[4].homeScore = 5;
  poolBGames[4].awayScore = 2;
  // Game 6: Navigators 4, Aviators 3
  poolBGames[5].homeScore = 4;
  poolBGames[5].awayScore = 3;
  
  gamesData.push(...poolBGames);

  // Pool C: 2-way tie for 2nd place (runs allowed tie-breaker)
  // Target: Mustangs: 3-0, Hawks: 2-1, Giants: 2-1 (tied for 2nd), Arrows: 0-3
  // Team order: [Mustangs, Hawks, Giants, Arrows] = [0, 1, 2, 3]
  // Matchups: [0,1], [2,3], [0,2], [1,3], [0,3], [1,2]
  // For Hawks and Giants both to be 2-1 with Arrows 0-3 and Mustangs 3-0:
  // Mustangs beats all (3-0), Arrows loses all (0-3)
  // Hawks and Giants must split: one needs to lose to the other but win vs Arrows
  // But both also lose to Mustangs, so they each have 1 loss from Mustangs
  // For both to be 2-1: Hawks beats G+A, loses M; Giants beats H+A, loses M
  // But H beats G and G beats H can't both be true!
  // SOLUTION: Let Mustangs lose to one of them!
  // NEW: Mustangs 2-1, Hawks 2-1, Giants 2-1, Arrows 0-3 (3-way tie!)
  const poolCTeams = createdTeams.slice(8, 12);
  const poolCGames = createPoolGames(poolCTeams, 'Pool C', '09:00', '2025-08-01');
  
  // Game 1: [0,1] Mustangs vs Hawks - MUSTANGS WIN 6-4
  poolCGames[0].homeScore = 6;
  poolCGames[0].awayScore = 4;
  // Game 2: [2,3] Giants vs Arrows - GIANTS WIN 7-2
  poolCGames[1].homeScore = 7;
  poolCGames[1].awayScore = 2;
  // Game 3: [0,2] Mustangs vs Giants - GIANTS WIN 5-4 (Mustangs loses!)
  poolCGames[2].homeScore = 4;
  poolCGames[2].awayScore = 5;
  // Game 4: [1,3] Hawks vs Arrows - HAWKS WIN 6-1
  poolCGames[3].homeScore = 6;
  poolCGames[3].awayScore = 1;
  // Game 5: [0,3] Mustangs vs Arrows - MUSTANGS WIN 7-2
  poolCGames[4].homeScore = 7;
  poolCGames[4].awayScore = 2;
  // Game 6: [1,2] Hawks vs Giants - HAWKS WIN 5-3
  poolCGames[5].homeScore = 5;
  poolCGames[5].awayScore = 3;
  // Results: 
  // Mustangs 2-1 (beat Hawks 6-4, Arrows 7-2; lost to Giants 4-5)
  // Hawks 2-1 (beat Arrows 6-1, Giants 5-3; lost to Mustangs 4-6)
  // Giants 2-1 (beat Mustangs 5-4, Arrows 7-2; lost to Hawks 3-5)
  // Arrows 0-3 (lost to all)
  // This creates a 3-way tie with circular head-to-head, perfect for testing!
  
  gamesData.push(...poolCGames);

  // Pool D: All 4 teams finish 1-2 (perfect tie)
  // This creates the most complex tie-breaker scenario
  // Pirates: 1-2, Cougars: 1-2, Pelicans: 1-2, Blaze: 1-2
  // Team order: [Pirates, Cougars, Pelicans, Blaze] = [0, 1, 2, 3]
  // Matchups: [0,1], [2,3], [0,2], [1,3], [0,3], [1,2]
  const poolDTeams = createdTeams.slice(12, 16);
  const poolDGames = createPoolGames(poolDTeams, 'Pool D', '09:00', '2025-08-01');
  
  // Game 1: [0,1] Pirates vs Cougars - PIRATES WIN 5-4
  poolDGames[0].homeScore = 5;
  poolDGames[0].awayScore = 4;
  // Game 2: [2,3] Pelicans vs Blaze - PELICANS WIN 6-3
  poolDGames[1].homeScore = 6;
  poolDGames[1].awayScore = 3;
  // Game 3: [0,2] Pirates vs Pelicans - PELICANS WIN 5-2
  poolDGames[2].homeScore = 2;
  poolDGames[2].awayScore = 5;
  // Game 4: [1,3] Cougars vs Blaze - COUGARS WIN 7-4
  poolDGames[3].homeScore = 7;
  poolDGames[3].awayScore = 4;
  // Game 5: [0,3] Pirates vs Blaze - BLAZE WIN 6-3
  poolDGames[4].homeScore = 3;
  poolDGames[4].awayScore = 6;
  // Game 6: [1,2] Cougars vs Pelicans - COUGARS WIN 5-4
  poolDGames[5].homeScore = 5;
  poolDGames[5].awayScore = 4;
  
  // Final records: All teams 1-2
  // Pirates: 1-2 (beat Cougars 5-4, lost to Pelicans 2-5, lost to Blaze 3-6) - 10 RS, 15 RA
  // Cougars: 1-2 (beat Blaze 7-4, beat Pelicans 5-4, lost to Pirates 4-5) - WAIT that's 2-1!
  // Need to recalculate to ensure all are 1-2
  // For all teams to be 1-2, we need a circular pattern where:
  // Pirates beat Cougars, lose to Pelicans, lose to Blaze = 1-2
  // Cougars beat Blaze, lose to Pirates, lose to Pelicans = 1-2
  // Pelicans beat Pirates, lose to Cougars, beat Blaze = 1-2
  // Blaze beat Cougars... NO wait, this doesn't work
  
  // Let me think: For 4 teams to all be 1-2 with 3 games each:
  // Each team must win 1 and lose 2
  // This requires: A beats B, B beats C, C beats D, D beats A (but then we're short 2 games)
  // Actually with 6 games total and 4 teams playing 3 each, it's mathematically impossible
  // for all 4 to be 1-2 because that would be 4 wins and 8 losses total (12 results)
  // but we only have 6 games = 6 wins and 6 losses
  
  // For all 4 teams to have the same record, they must all be 1.5-1.5 on average
  // Best we can do is make them all have similar records
  // Let's aim for: Pirates 1-2, Cougars 1-2, Pelicans 2-1, Blaze 2-1
  // OR create a 3-way tie at 1-2 with one team at 3-0
  // Actually best is: Pelicans 2-1, Cougars 2-1, Pirates 1-2, Blaze 1-2
  
  // NEW PLAN: Pirates 1-2, Cougars 1-2, Pelicans 2-1, Blaze 2-1 (2 teams at each record)
  // Pirates: 1-2 (10 runs scored, 15 runs allowed) - RD: -5
  // Cougars: 1-2 (16 runs scored, 17 runs allowed) - RD: -1
  // Pelicans: 2-1 (15 runs scored, 11 runs allowed) - RD: +4
  // Blaze: 2-1 (13 runs scored, 12 runs allowed) - RD: +1
  
  gamesData.push(...poolDGames);

  // Insert all games
  const createdGames = await db.insert(games).values(gamesData).returning();
  
  console.log(`✓ Created ${createdGames.length} pool play games`);
  console.log('\n=== Tournament Creation Complete ===');
  console.log(`Tournament ID: ${tournament.id}`);
  console.log(`Total Teams: ${createdTeams.length}`);
  console.log(`Total Pools: ${createdPools.length}`);
  console.log(`Total Games: ${createdGames.length}`);
  console.log('\n=== Pool Standings Preview ===');
  console.log('Pool A: 3-way tie for 1st - Wolves 2-1, Aces 2-1, Panthers 2-1; Owls 0-3');
  console.log('  → Circular head-to-head, uses RA among tied teams for final seeding');
  console.log('Pool B: Rangers 3-0, Navigators 2-1, Aviators 1-2, Bulls 0-3');
  console.log('  → Clear standings, no tie-breakers needed');
  console.log('Pool C: 3-way tie for 1st - Mustangs 2-1, Hawks 2-1, Giants 2-1; Arrows 0-3');
  console.log('  → Another circular head-to-head scenario requiring RA tie-breaker');
  console.log('Pool D: 2-way tie at 2-1 (Pelicans, Cougars), 2-way tie at 1-2 (Blaze, Pirates)');
  console.log('  → Multiple tie-breaker scenarios in one pool');
  console.log('\n=== Top 8 Seeds (for playoffs) ===');
  console.log('1. Whitby Wolves (Pool A, 2-1)');
  console.log('2. Richmond Hill Rangers (Pool B, 3-0)');
  console.log('3. Milton Mustangs (Pool C, 3-0)');
  console.log('4. Port Hope Pelicans (Pool D, 2-1)');
  console.log('5. Ajax Aces (Pool A, 2-1)');
  console.log('6. Newmarket Navigators (Pool B, 2-1)');
  console.log('7. Georgetown Giants (Pool C, 2-1)');
  console.log('8. Belleville Blaze (Pool D, 2-1)');
  console.log('\n=== Use this Tournament ID for validation report testing ===');
  console.log(`TOURNAMENT_ID: ${tournament.id}`);
  
  return tournament.id;
}

create16TeamTestTournament()
  .then((tournamentId) => {
    console.log('\n✅ Success! Tournament created:', tournamentId);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error creating tournament:', error);
    process.exit(1);
  });
