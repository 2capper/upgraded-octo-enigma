import { storage } from '../server/storage.js';
import { calculateStats, resolveTie } from '../shared/standings.js';
import { getBracketStructure } from '../shared/bracketStructure.js';
import { getPlayoffTeamsFromStandings } from '../shared/bracketGeneration.js';
import { nanoid } from 'nanoid';

const tournamentId = 'natasha-nice-2025-11';
const divisionId = 'natasha-nice-2025-11_div_18U';

async function regenerate() {
  try {
    console.log('Fetching tournament data...');
    
    const tournament = await storage.getTournament(tournamentId);
    if (!tournament) throw new Error('Tournament not found');
    
    const playoffFormat = tournament.playoffFormat || 'top_8';
    const seedingPattern = tournament.seedingPattern || 'standard';
    
    console.log(`Format: ${playoffFormat}, Seeding: ${seedingPattern}`);
    
    // Get pools, teams, and games
    const pools = await storage.getPools(tournamentId);
    const teams = await storage.getTeams(tournamentId);
    const allGames = await storage.getGames(tournamentId);
    
    const poolPlayGames = allGames.filter(g => !g.isPlayoff && g.status === 'completed');
    
    // Get division pools
    const divisionPools = pools.filter(p => p.ageDivisionId === divisionId && !p.name.toLowerCase().includes('playoff'));
    const divisionPoolIds = divisionPools.map(p => p.id);
    const divisionTeams = teams.filter(t => divisionPoolIds.includes(t.poolId));
    const divisionTeamIds = divisionTeams.map(t => t.id);
    
    const divisionGames = poolPlayGames.filter(g => 
      g.homeTeamId && g.awayTeamId &&
      divisionTeamIds.includes(g.homeTeamId) && divisionTeamIds.includes(g.awayTeamId)
    );
    
    // Calculate standings per pool first
    const standingsByPool: any[] = [];
    
    for (const pool of divisionPools) {
      const poolTeams = divisionTeams.filter(t => t.poolId === pool.id);
      const poolTeamIds = poolTeams.map(t => t.id);
      const poolGames = divisionGames.filter(g =>
        g.homeTeamId && g.awayTeamId &&
        poolTeamIds.includes(g.homeTeamId) && poolTeamIds.includes(g.awayTeamId)
      );
      
      const teamsWithStats = poolTeams.map(team => {
        const stats = calculateStats(team.id, poolGames);
        return {
          ...team,
          ...stats,
          points: (stats.wins * 2) + (stats.ties * 1),
          runsAgainstPerInning: stats.defensiveInnings > 0 ? (stats.runsAgainst / stats.defensiveInnings) : 0,
          runsForPerInning: stats.offensiveInnings > 0 ? (stats.runsFor / stats.offensiveInnings) : 0,
        };
      });
      
      const sortedByPoints = teamsWithStats.sort((a, b) => b.points - a.points);
      const poolStandings = resolveTie(sortedByPoints, poolGames);
      
      poolStandings.forEach((team, index) => {
        standingsByPool.push({
          teamId: team.id,
          teamName: team.name,
          rank: index + 1,
          poolId: pool.id,
          poolName: pool.name,
          points: team.points,
        });
      });
    }
    
    // Apply cross-pool seeding
    const seededTeams = getPlayoffTeamsFromStandings(
      standingsByPool, 
      playoffFormat, 
      seedingPattern,
      tournament.numberOfPools || 4
    );
    
    console.log('\nSeeded teams (cross-pool):');
    seededTeams.forEach(team => {
      const teamData = standingsByPool.find(t => t.teamId === team.teamId);
      console.log(`Seed ${team.seed}: ${teamData?.teamName || 'Unknown'} (${team.poolName} rank ${team.poolRank})`);
    });
    
    // Generate playoff games using seeded teams
    const bracketStructure = getBracketStructure(playoffFormat);
    const playoffGames = bracketStructure.map(slot => {
      const game: any = {
        id: nanoid(),
        tournamentId,
        ageDivisionId: divisionId,
        isPlayoff: true,
        playoffRound: slot.round,
        playoffGameNumber: slot.gameNumber,
        status: 'scheduled',
        date: '',
        time: '',
        location: '',
        subVenue: '',
        poolId: divisionPools[0]?.id || null,
      };
      
      if (slot.homeSource.type === 'seed') {
        const seededTeam = seededTeams.find(t => t.seed === slot.homeSource.rank);
        game.homeTeamId = seededTeam?.teamId || null;
      } else {
        game.homeTeamId = null;
        game.team1Source = {
          type: 'winner',
          gameNumber: slot.homeSource.gameNumber,
          round: slot.homeSource.round
        };
      }
      
      if (slot.awaySource.type === 'seed') {
        const seededTeam = seededTeams.find(t => t.seed === slot.awaySource.rank);
        game.awayTeamId = seededTeam?.teamId || null;
      } else {
        game.awayTeamId = null;
        game.team2Source = {
          type: 'winner',
          gameNumber: slot.awaySource.gameNumber,
          round: slot.awaySource.round
        };
      }
      
      return game;
    });
    
    // Insert games
    console.log(`\nInserting ${playoffGames.length} playoff games...`);
    for (const gameData of playoffGames) {
      await storage.createGame(gameData);
    }
    
    console.log('\nQuarterfinals:');
    const qfGames = playoffGames.filter(g => g.playoffRound === 1);
    qfGames.forEach((g, i) => {
      const homeTeam = standingsByPool.find(t => t.teamId === g.homeTeamId);
      const awayTeam = standingsByPool.find(t => t.teamId === g.awayTeamId);
      console.log(`QF${i + 1}: ${homeTeam?.teamName || 'TBD'} vs ${awayTeam?.teamName || 'TBD'}`);
    });
    
    console.log('\n✅ Playoff bracket regenerated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

regenerate();
