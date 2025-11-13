import { db } from './server/db';
import { tournaments, ageDivisions, pools, teams, games } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const OBA_ORG_ID = '6a5b4682-8b33-4058-992d-576b78acb367';

interface TournamentConfig {
  teamCount: 8 | 12 | 16;
  poolCount: 2 | 3 | 4;
  playoffFormat: 'top_4' | 'top_6' | 'top_8';
  seedingPattern: 'standard' | 'cross_pool_4';
  name: string;
  idSuffix: string;
}

interface TeamData {
  name: string;
  city: string;
  coach: string;
  poolName: string;
}

interface GameScore {
  homeScore: number;
  awayScore: number;
  homeInningScores: number[];
  awayInningScores: number[];
}

const generateInningScores = (finalScore: number): number[] => {
  const innings = 6;
  const scores: number[] = [];
  let remaining = finalScore;
  
  for (let i = 0; i < innings; i++) {
    if (i === innings - 1) {
      scores.push(remaining);
    } else {
      const maxForInning = Math.min(remaining, Math.ceil(finalScore / 3));
      const score = Math.floor(Math.random() * (maxForInning + 1));
      scores.push(score);
      remaining -= score;
    }
  }
  
  return scores;
};

// Generate defensive innings (3 outs per complete inning)
const generateDefenseScores = (offenseScores: number[]): number[] => {
  // Each complete inning has 3 outs
  return offenseScores.map(() => 3);
};

const createGameScore = (homeScore: number, awayScore: number): GameScore => {
  return {
    homeScore,
    awayScore,
    homeInningScores: generateInningScores(homeScore),
    awayInningScores: generateInningScores(awayScore),
  };
};

async function createPoolPlayTournament(config: TournamentConfig, teamsList: TeamData[]) {
  const tournamentId = `test-${config.idSuffix}-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating ${config.name}...`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const existingTournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (existingTournament) {
      console.log(`⚠️  Tournament ${tournamentId} already exists. Deleting...`);
      await db.delete(games).where(eq(games.tournamentId, tournamentId));
      await db.delete(teams).where(eq(teams.tournamentId, tournamentId));
      await db.delete(pools).where(eq(pools.tournamentId, tournamentId));
      await db.delete(ageDivisions).where(eq(ageDivisions.tournamentId, tournamentId));
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
      console.log('✓ Deleted existing tournament and all related data\n');
    }
  } catch (error) {
    console.log('No existing tournament found, proceeding with creation...\n');
  }

  const [tournament] = await db.insert(tournaments).values({
    id: tournamentId,
    name: config.name,
    type: 'pool_play',
    organizationId: OBA_ORG_ID,
    numberOfTeams: config.teamCount,
    numberOfPools: config.poolCount,
    playoffFormat: config.playoffFormat,
    seedingPattern: config.seedingPattern,
    startDate: '2025-08-01',
    endDate: '2025-08-03',
    showTiebreakers: true,
    primaryColor: '#22c55e',
    secondaryColor: '#ffffff',
  }).returning();
  
  console.log(`✓ Created tournament: ${tournament.id}`);

  const divisionId = `${tournamentId}-13u`;
  const [division] = await db.insert(ageDivisions).values({
    id: divisionId,
    name: '13U',
    tournamentId: tournament.id,
  }).returning();
  
  console.log(`✓ Created age division: ${division.name}`);

  const poolNames = ['Pool A', 'Pool B', 'Pool C', 'Pool D'].slice(0, config.poolCount);
  const poolData = poolNames.map((name, idx) => ({
    id: `${tournamentId}-pool-${String.fromCharCode(97 + idx)}`,
    name,
  }));

  const createdPools = await db.insert(pools).values(
    poolData.map(p => ({
      id: p.id,
      name: p.name,
      tournamentId: tournament.id,
      ageDivisionId: division.id,
    }))
  ).returning();
  
  console.log(`✓ Created ${createdPools.length} pools`);

  const createdTeams = await db.insert(teams).values(
    teamsList.map(t => {
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

  const gamesData = [];
  
  const createPoolGames = (poolTeams: typeof createdTeams, poolName: string, poolIndex: number) => {
    const poolGames = [];
    const pool = createdPools.find(p => p.name === poolName)!;
    
    const matchups = [
      [0, 1], [2, 3],
      [0, 2], [1, 3],
      [0, 3], [1, 2],
    ];
    
    matchups.forEach((matchup, idx) => {
      const [homeIdx, awayIdx] = matchup;
      const gameDate = idx < 2 ? '2025-08-01' : idx < 4 ? '2025-08-01' : '2025-08-02';
      const hour = 9 + Math.floor(idx / 2) * 2;
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
        location: `Diamond ${poolIndex + 1}`,
        subVenue: `Field ${poolName.charAt(poolName.length - 1)}`,
        isPlayoff: false,
        forfeitStatus: 'none' as const,
        homeScore: 0,
        awayScore: 0,
        homeInningScores: [],
        awayInningScores: [],
        homeInningsDefense: [],
        awayInningsDefense: [],
      });
    });
    
    return poolGames;
  };

  for (let poolIdx = 0; poolIdx < config.poolCount; poolIdx++) {
    const poolName = poolNames[poolIdx];
    const teamsPerPool = config.teamCount / config.poolCount;
    const poolTeams = createdTeams.slice(poolIdx * teamsPerPool, (poolIdx + 1) * teamsPerPool);
    const poolGames = createPoolGames(poolTeams, poolName, poolIdx);
    
    if (poolIdx === 0) {
      const score1 = createGameScore(6, 5);
      poolGames[0] = { ...poolGames[0], ...score1, homeInningsDefense: generateDefenseScores(score1.homeInningScores), awayInningsDefense: generateDefenseScores(score1.awayInningScores) };
      const score2 = createGameScore(7, 2);
      poolGames[1] = { ...poolGames[1], ...score2, homeInningsDefense: generateDefenseScores(score2.homeInningScores), awayInningsDefense: generateDefenseScores(score2.awayInningScores) };
      const score3 = createGameScore(3, 4);
      poolGames[2] = { ...poolGames[2], ...score3, homeInningsDefense: generateDefenseScores(score3.homeInningScores), awayInningsDefense: generateDefenseScores(score3.awayInningScores) };
      const score4 = createGameScore(8, 1);
      poolGames[3] = { ...poolGames[3], ...score4, homeInningsDefense: generateDefenseScores(score4.homeInningScores), awayInningsDefense: generateDefenseScores(score4.awayInningScores) };
      const score5 = createGameScore(9, 2);
      poolGames[4] = { ...poolGames[4], ...score5, homeInningsDefense: generateDefenseScores(score5.homeInningScores), awayInningsDefense: generateDefenseScores(score5.awayInningScores) };
      const score6 = createGameScore(5, 4);
      poolGames[5] = { ...poolGames[5], ...score6, homeInningsDefense: generateDefenseScores(score6.homeInningScores), awayInningsDefense: generateDefenseScores(score6.awayInningScores) };
    } else if (poolIdx === 1) {
      const score1 = createGameScore(7, 4);
      poolGames[0] = { ...poolGames[0], ...score1, homeInningsDefense: generateDefenseScores(score1.homeInningScores), awayInningsDefense: generateDefenseScores(score1.awayInningScores) };
      const score2 = createGameScore(5, 3);
      poolGames[1] = { ...poolGames[1], ...score2, homeInningsDefense: generateDefenseScores(score2.homeInningScores), awayInningsDefense: generateDefenseScores(score2.awayInningScores) };
      const score3 = createGameScore(6, 2);
      poolGames[2] = { ...poolGames[2], ...score3, homeInningsDefense: generateDefenseScores(score3.homeInningScores), awayInningsDefense: generateDefenseScores(score3.awayInningScores) };
      const score4 = createGameScore(8, 1);
      poolGames[3] = { ...poolGames[3], ...score4, homeInningsDefense: generateDefenseScores(score4.homeInningScores), awayInningsDefense: generateDefenseScores(score4.awayInningScores) };
      const score5 = createGameScore(5, 2);
      poolGames[4] = { ...poolGames[4], ...score5, homeInningsDefense: generateDefenseScores(score5.homeInningScores), awayInningsDefense: generateDefenseScores(score5.awayInningScores) };
      const score6 = createGameScore(4, 3);
      poolGames[5] = { ...poolGames[5], ...score6, homeInningsDefense: generateDefenseScores(score6.homeInningScores), awayInningsDefense: generateDefenseScores(score6.awayInningScores) };
    } else if (poolIdx === 2) {
      const score1 = createGameScore(6, 4);
      poolGames[0] = { ...poolGames[0], ...score1, homeInningsDefense: generateDefenseScores(score1.homeInningScores), awayInningsDefense: generateDefenseScores(score1.awayInningScores) };
      const score2 = createGameScore(7, 2);
      poolGames[1] = { ...poolGames[1], ...score2, homeInningsDefense: generateDefenseScores(score2.homeInningScores), awayInningsDefense: generateDefenseScores(score2.awayInningScores) };
      const score3 = createGameScore(4, 5);
      poolGames[2] = { ...poolGames[2], ...score3, homeInningsDefense: generateDefenseScores(score3.homeInningScores), awayInningsDefense: generateDefenseScores(score3.awayInningScores) };
      const score4 = createGameScore(6, 1);
      poolGames[3] = { ...poolGames[3], ...score4, homeInningsDefense: generateDefenseScores(score4.homeInningScores), awayInningsDefense: generateDefenseScores(score4.awayInningScores) };
      const score5 = createGameScore(7, 2);
      poolGames[4] = { ...poolGames[4], ...score5, homeInningsDefense: generateDefenseScores(score5.homeInningScores), awayInningsDefense: generateDefenseScores(score5.awayInningScores) };
      const score6 = createGameScore(5, 3);
      poolGames[5] = { ...poolGames[5], ...score6, homeInningsDefense: generateDefenseScores(score6.homeInningScores), awayInningsDefense: generateDefenseScores(score6.awayInningScores) };
    } else if (poolIdx === 3) {
      const score1 = createGameScore(5, 4);
      poolGames[0] = { ...poolGames[0], ...score1, homeInningsDefense: generateDefenseScores(score1.homeInningScores), awayInningsDefense: generateDefenseScores(score1.awayInningScores) };
      const score2 = createGameScore(6, 3);
      poolGames[1] = { ...poolGames[1], ...score2, homeInningsDefense: generateDefenseScores(score2.homeInningScores), awayInningsDefense: generateDefenseScores(score2.awayInningScores) };
      const score3 = createGameScore(2, 5);
      poolGames[2] = { ...poolGames[2], ...score3, homeInningsDefense: generateDefenseScores(score3.homeInningScores), awayInningsDefense: generateDefenseScores(score3.awayInningScores) };
      const score4 = createGameScore(7, 4);
      poolGames[3] = { ...poolGames[3], ...score4, homeInningsDefense: generateDefenseScores(score4.homeInningScores), awayInningsDefense: generateDefenseScores(score4.awayInningScores) };
      const score5 = createGameScore(3, 6);
      poolGames[4] = { ...poolGames[4], ...score5, homeInningsDefense: generateDefenseScores(score5.homeInningScores), awayInningsDefense: generateDefenseScores(score5.awayInningScores) };
      const score6 = createGameScore(5, 4);
      poolGames[5] = { ...poolGames[5], ...score6, homeInningsDefense: generateDefenseScores(score6.homeInningScores), awayInningsDefense: generateDefenseScores(score6.awayInningScores) };
    }
    
    gamesData.push(...poolGames);
  }

  const createdGames = await db.insert(games).values(gamesData).returning();
  
  console.log(`✓ Created ${createdGames.length} pool play games with complete inning-by-inning scoring`);
  console.log('\n=== Tournament Summary ===');
  console.log(`Tournament ID: ${tournament.id}`);
  console.log(`Teams: ${config.teamCount} (${config.poolCount} pools x ${config.teamCount / config.poolCount} teams)`);
  console.log(`Games: ${createdGames.length} (${createdGames.length / config.poolCount} games per pool)`);
  console.log(`Playoff Format: ${config.playoffFormat}`);
  console.log(`Seeding Pattern: ${config.seedingPattern}`);
  
  return tournament.id;
}

const TOURNAMENT_CONFIGS: TournamentConfig[] = [
  {
    teamCount: 8,
    poolCount: 2,
    playoffFormat: 'top_4',
    seedingPattern: 'standard',
    name: 'TEST - 8 Team Top 4 Standard',
    idSuffix: '8-team-top-4-standard',
  },
  {
    teamCount: 12,
    poolCount: 3,
    playoffFormat: 'top_6',
    seedingPattern: 'standard',
    name: 'TEST - 12 Team Top 6 Standard',
    idSuffix: '12-team-top-6-standard',
  },
  {
    teamCount: 16,
    poolCount: 4,
    playoffFormat: 'top_8',
    seedingPattern: 'cross_pool_4',
    name: 'TEST - 16 Team Top 8 Cross-Pool',
    idSuffix: '16-team-top-8-cross-pool',
  },
];

const TEAM_DATA_8: TeamData[] = [
  { name: 'Brampton Bandits', city: 'Brampton', coach: 'Mike Thompson', poolName: 'Pool A' },
  { name: 'Mississauga Meteors', city: 'Mississauga', coach: 'Sarah Johnson', poolName: 'Pool A' },
  { name: 'Oakville Orcas', city: 'Oakville', coach: 'Dave Wilson', poolName: 'Pool A' },
  { name: 'Burlington Bisons', city: 'Burlington', coach: 'Lisa Anderson', poolName: 'Pool A' },
  { name: 'Hamilton Hawks', city: 'Hamilton', coach: 'John Martinez', poolName: 'Pool B' },
  { name: 'Stoney Creek Storm', city: 'Stoney Creek', coach: 'Emma Brown', poolName: 'Pool B' },
  { name: 'Ancaster Aces', city: 'Ancaster', coach: 'Robert Taylor', poolName: 'Pool B' },
  { name: 'Dundas Dragons', city: 'Dundas', coach: 'Michelle Lee', poolName: 'Pool B' },
];

const TEAM_DATA_12: TeamData[] = [
  { name: 'Toronto Titans', city: 'Toronto', coach: 'James Smith', poolName: 'Pool A' },
  { name: 'North York Navigators', city: 'North York', coach: 'Jessica Wang', poolName: 'Pool A' },
  { name: 'Scarborough Scorpions', city: 'Scarborough', coach: 'Chris Evans', poolName: 'Pool A' },
  { name: 'Etobicoke Eagles', city: 'Etobicoke', coach: 'Amanda Chen', poolName: 'Pool A' },
  { name: 'Vaughan Vipers', city: 'Vaughan', coach: 'Peter Romano', poolName: 'Pool B' },
  { name: 'Markham Mavericks', city: 'Markham', coach: 'Susan Park', poolName: 'Pool B' },
  { name: 'Richmond Hill Rockets', city: 'Richmond Hill', coach: 'David Kim', poolName: 'Pool B' },
  { name: 'Thornhill Thunder', city: 'Thornhill', coach: 'Karen Singh', poolName: 'Pool B' },
  { name: 'Kitchener Kings', city: 'Kitchener', coach: 'Paul Jackson', poolName: 'Pool C' },
  { name: 'Waterloo Warriors', city: 'Waterloo', coach: 'Marie Dubois', poolName: 'Pool C' },
  { name: 'Cambridge Crusaders', city: 'Cambridge', coach: 'Tom Murphy', poolName: 'Pool C' },
  { name: 'Guelph Grizzlies', city: 'Guelph', coach: 'Rachel Green', poolName: 'Pool C' },
];

const TEAM_DATA_16: TeamData[] = [
  { name: 'Ajax Aces', city: 'Ajax', coach: 'Tom Henderson', poolName: 'Pool A' },
  { name: 'Pickering Panthers', city: 'Pickering', coach: 'Sandra Mitchell', poolName: 'Pool A' },
  { name: 'Whitby Wolves', city: 'Whitby', coach: 'Derek Campbell', poolName: 'Pool A' },
  { name: 'Oshawa Owls', city: 'Oshawa', coach: 'Patricia Lee', poolName: 'Pool A' },
  { name: 'Richmond Hill Rangers', city: 'Richmond Hill', coach: 'Michael Chang', poolName: 'Pool B' },
  { name: 'Newmarket Navigators', city: 'Newmarket', coach: 'Jennifer Walsh', poolName: 'Pool B' },
  { name: 'Aurora Aviators', city: 'Aurora', coach: 'Steve Peterson', poolName: 'Pool B' },
  { name: 'Bradford Bulls', city: 'Bradford', coach: 'Maria Santos', poolName: 'Pool B' },
  { name: 'Milton Mustangs', city: 'Milton', coach: 'Andrew Miller', poolName: 'Pool C' },
  { name: 'Halton Hawks', city: 'Halton Hills', coach: 'Rebecca Turner', poolName: 'Pool C' },
  { name: 'Georgetown Giants', city: 'Georgetown', coach: 'Daniel Kim', poolName: 'Pool C' },
  { name: 'Acton Arrows', city: 'Acton', coach: 'Laura Cooper', poolName: 'Pool C' },
  { name: 'Peterborough Pirates', city: 'Peterborough', coach: 'Richard Davis', poolName: 'Pool D' },
  { name: 'Cobourg Cougars', city: 'Cobourg', coach: 'Michelle Brown', poolName: 'Pool D' },
  { name: 'Port Hope Pelicans', city: 'Port Hope', coach: 'Jason Taylor', poolName: 'Pool D' },
  { name: 'Belleville Blaze', city: 'Belleville', coach: 'Angela White', poolName: 'Pool D' },
];

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Pool Play Test Tournament Generator                      ║');
  console.log('║  Generating 3 comprehensive test tournaments              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = [];

  try {
    const id8Team = await createPoolPlayTournament(TOURNAMENT_CONFIGS[0], TEAM_DATA_8);
    results.push({ config: TOURNAMENT_CONFIGS[0], id: id8Team });

    const id12Team = await createPoolPlayTournament(TOURNAMENT_CONFIGS[1], TEAM_DATA_12);
    results.push({ config: TOURNAMENT_CONFIGS[1], id: id12Team });

    const id16Team = await createPoolPlayTournament(TOURNAMENT_CONFIGS[2], TEAM_DATA_16);
    results.push({ config: TOURNAMENT_CONFIGS[2], id: id16Team });

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ALL TOURNAMENTS CREATED SUCCESSFULLY                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('Tournament IDs:');
    results.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.config.name}`);
      console.log(`     ID: ${result.id}`);
      console.log(`     Format: ${result.config.playoffFormat} | Seeding: ${result.config.seedingPattern}\n`);
    });

    console.log('✅ All tournaments include:');
    console.log('   • Complete inning-by-inning scoring (6 innings)');
    console.log('   • Defense stats per inning');
    console.log('   • Location fields (Diamond 1, 2, 3, 4)');
    console.log('   • Completed game status');
    console.log('   • Realistic Ontario team names');
    console.log('   • Varied scores for tie-breaker scenarios\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating tournaments:', error);
    process.exit(1);
  }
}

main();
