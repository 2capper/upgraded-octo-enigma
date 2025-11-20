import type { Pool } from 'pg';
import { nanoid } from 'nanoid';

let pgPool: Pool | null = null;

function getDbPool(): Pool {
  if (!pgPool) {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pgPool;
}

export function setupNodeEvents(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
) {
  on('task', {
    async 'seed:tournamentWithTeams'() {
      const pool = getDbPool();
      
      // Create organization
      const orgId = nanoid();
      await pool.query(
        `INSERT INTO organizations (id, name, slug, timezone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [orgId, 'Test Org', `test-org-${Date.now()}`, 'America/Toronto']
      );

      // Create tournament
      const tournamentId = nanoid();
      await pool.query(
        `INSERT INTO tournaments (id, name, organization_id, start_date, end_date, location, playoff_format, seeding_pattern, visibility, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [tournamentId, 'Test Tournament', orgId, '2025-07-01', '2025-07-03', 'Test Field', 'cross_pool_4', 'sequential', 'private']
      );

      // Create division
      const divisionId = nanoid();
      await pool.query(
        `INSERT INTO divisions (id, tournament_id, name, age_group, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [divisionId, tournamentId, '13U', '13U']
      );

      // Create Pool A
      const poolAId = nanoid();
      await pool.query(
        `INSERT INTO pools (id, tournament_id, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [poolAId, tournamentId, 'Pool A']
      );

      // Create Pool B
      const poolBId = nanoid();
      await pool.query(
        `INSERT INTO pools (id, tournament_id, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [poolBId, tournamentId, 'Pool B']
      );

      // Create Team 1 (unassigned)
      const team1Id = nanoid();
      await pool.query(
        `INSERT INTO teams (id, tournament_id, name, city, division, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [team1Id, tournamentId, 'Dragons', 'Toronto', '13U']
      );

      // Create Team 2 (unassigned)
      const team2Id = nanoid();
      await pool.query(
        `INSERT INTO teams (id, tournament_id, name, city, division, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [team2Id, tournamentId, 'Warriors', 'Mississauga', '13U']
      );

      return {
        organizationId: orgId,
        tournamentId,
        divisionId,
        team1Id,
        team2Id,
        poolAId,
        poolBId,
      };
    },

    async 'seed:fullTournament'() {
      const pool = getDbPool();
      
      // Create organization
      const orgId = nanoid();
      await pool.query(
        `INSERT INTO organizations (id, name, slug, timezone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [orgId, 'Full Test Org', `full-test-org-${Date.now()}`, 'America/Toronto']
      );

      // Create tournament
      const tournamentId = nanoid();
      await pool.query(
        `INSERT INTO tournaments (id, name, organization_id, start_date, end_date, location, playoff_format, seeding_pattern, visibility, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [tournamentId, 'Full Tournament', orgId, '2025-07-01', '2025-07-03', 'Full Field', 'cross_pool_4', 'sequential', 'public']
      );

      // Create division
      const divisionId = nanoid();
      const divisionName = '13U';
      await pool.query(
        `INSERT INTO divisions (id, tournament_id, name, age_group, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [divisionId, tournamentId, divisionName, divisionName]
      );

      // Create 4 pools (A, B, C, D)
      const poolIds: { [key: string]: string } = {};
      for (const poolName of ['Pool A', 'Pool B', 'Pool C', 'Pool D']) {
        const poolId = nanoid();
        poolIds[poolName] = poolId;
        await pool.query(
          `INSERT INTO pools (id, tournament_id, name, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [poolId, tournamentId, poolName]
        );
      }

      // Create 16 teams (4 per pool) with pool assignments
      const teamIds: string[] = [];
      const poolNames = Object.keys(poolIds);
      for (let i = 0; i < 16; i++) {
        const teamId = nanoid();
        teamIds.push(teamId);
        const poolName = poolNames[Math.floor(i / 4)];
        const poolId = poolIds[poolName];
        
        await pool.query(
          `INSERT INTO teams (id, tournament_id, name, city, division, pool_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [teamId, tournamentId, `Team ${i + 1}`, `City ${i + 1}`, divisionName, poolId]
        );
      }

      // Create complete pool play games with scores
      for (let poolIndex = 0; poolIndex < 4; poolIndex++) {
        const poolId = Object.values(poolIds)[poolIndex];
        const poolTeams = teamIds.slice(poolIndex * 4, (poolIndex + 1) * 4);
        
        // Round robin within each pool (6 games per pool)
        const matchups = [
          [0, 1], [2, 3], // Game 1, 2
          [0, 2], [1, 3], // Game 3, 4
          [0, 3], [1, 2], // Game 5, 6
        ];
        
        for (const [homeIdx, awayIdx] of matchups) {
          const gameId = nanoid();
          await pool.query(
            `INSERT INTO games (id, tournament_id, pool_id, home_team_id, away_team_id, date, time, is_playoff, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [gameId, tournamentId, poolId, poolTeams[homeIdx], poolTeams[awayIdx], '2025-07-01', '09:00', false]
          );
          
          // Add scores (home team wins with 5-3)
          await pool.query(
            `UPDATE games SET home_score = 5, away_score = 3, status = 'final' WHERE id = $1`,
            [gameId]
          );
        }
      }

      return {
        organizationId: orgId,
        tournamentId,
        divisionId,
        divisionName,
      };
    },

    async 'db:deleteTournament'(tournamentId: string) {
      const pool = getDbPool();
      
      // Get organization ID before deleting
      const { rows } = await pool.query(
        'SELECT organization_id FROM tournaments WHERE id = $1',
        [tournamentId]
      );
      
      if (rows.length > 0) {
        const orgId = rows[0].organization_id;
        
        // Delete in correct order due to foreign keys
        await pool.query('DELETE FROM games WHERE tournament_id = $1', [tournamentId]);
        await pool.query('DELETE FROM teams WHERE tournament_id = $1', [tournamentId]);
        await pool.query('DELETE FROM pools WHERE tournament_id = $1', [tournamentId]);
        await pool.query('DELETE FROM divisions WHERE tournament_id = $1', [tournamentId]);
        await pool.query('DELETE FROM tournaments WHERE id = $1', [tournamentId]);
        await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
      }
      
      return null;
    },
  });

  return config;
}
