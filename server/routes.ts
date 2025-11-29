import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { userService } from "./services/userService";
import { organizationService } from "./services/organizationService";
import { diamondService } from "./services/diamondService";
import { teamService } from "./services/teamService";
import { tournamentService } from "./services/tournamentService";
import { gameService } from "./services/gameService";
import { playoffService } from "./services/playoffService";
import { smsService } from "./services/smsService";
import { 
  insertOrganizationCoordinatorSchema,
  tournaments,
  games,
  matchups,
} from "@shared/schema";
import { createAuthRouter } from "./routes/auth";
import usersRoutes from "./routes/users";
import organizationsRoutes from "./routes/organizations";
import allocationRoutes from "./routes/allocationRoutes";
import tournamentRoutes from "./routes/tournaments";
import teamsRoutes from "./routes/teams";
import diamondRoutes from "./routes/diamonds";
import gamesRoutes from "./routes/games";
import bookingRoutes from "./routes/booking";
import invitationsRoutes from "./routes/invitations";
import communicationRoutes from "./routes/communication";
import weatherRoutes from "./routes/weather";
import { validateGameSlot } from "@shared/validation/gameSlotValidator";
import { setupAuth, isAuthenticated, requireAdmin, requireSuperAdmin, requireOrgAdmin, requireDiamondBooking, sanitizeUser } from "./auth";
import { generateValidationReport } from "./validationReport";
import { nanoid } from "nanoid";

async function autoCreatePoolsForDivision(tournamentId: string, divisionId: string) {
  const poolNames = ['A', 'B', 'C', 'D'];
  for (const name of poolNames) {
    await tournamentService.createPool({
      id: `${tournamentId}-${divisionId}-pool-${name.toLowerCase()}`,
      name: `Pool ${name}`,
      tournamentId,
      ageDivisionId: divisionId
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  
  const isTestEnv = process.env.NODE_ENV !== 'production';
  const authRouter = createAuthRouter(isTestEnv);
  app.use("/api", authRouter);
  
  app.use("/api", usersRoutes);
  app.use("/api", organizationsRoutes);
  app.use("/api", tournamentRoutes);
  app.use("/api", teamsRoutes);
  app.use("/api", allocationRoutes);
  app.use("/api", diamondRoutes);
  app.use("/api", gamesRoutes);
  app.use("/api", bookingRoutes);
  app.use("/api", invitationsRoutes);
  app.use("/api", communicationRoutes);
  app.use("/api", weatherRoutes);

  app.post("/api/tournaments/:tournamentId/auto-distribute-pools", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.params;
      const { numberOfPools, divisionId } = req.body;
      
      if (!numberOfPools || numberOfPools < 1) {
        return res.status(400).json({ error: "Number of pools must be at least 1" });
      }

      if (!divisionId) {
        return res.status(400).json({ error: "Division ID is required" });
      }
      
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const ageDivisions = await tournamentService.getAgeDivisions(tournamentId);
      const division = ageDivisions.find(d => d.id === divisionId);
      if (!division) {
        return res.status(404).json({ error: "Division not found" });
      }
      
      const allTeams = await teamService.getTeams(tournamentId);
      const allPools = await tournamentService.getPools(tournamentId);

      const divisionPoolIds = allPools
        .filter(p => p.ageDivisionId === divisionId)
        .map(p => p.id);
      
      const teams = allTeams.filter(t => {
        if (t.division === division.name) {
          return true;
        }
        if (t.poolId && divisionPoolIds.includes(t.poolId)) {
          return true;
        }
        return false;
      });
      
      if (teams.length === 0) {
        return res.status(400).json({ error: `No teams found for ${division.name} division. Make sure teams have the division field set to "${division.name}" when importing.` });
      }
      
      const divisionPools = allPools.filter(p => p.ageDivisionId === divisionId);
      const nonTempPools = divisionPools.filter(p => !p.id.includes('_pool_temp_'));
      for (const pool of nonTempPools) {
        await tournamentService.deletePool(pool.id);
      }
      
      const poolNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const createdPools = [];
      for (let i = 0; i < numberOfPools; i++) {
        const pool = await tournamentService.createPool({
          id: `${tournamentId}-${divisionId}-pool-${poolNames[i].toLowerCase()}`,
          name: `Pool ${poolNames[i]}`,
          tournamentId,
          ageDivisionId: divisionId
        });
        createdPools.push(pool);
      }
      
      const updatedTeams = [];
      for (let i = 0; i < teams.length; i++) {
        const round = Math.floor(i / numberOfPools);
        const positionInRound = i % numberOfPools;
        const poolIndex = round % 2 === 0 
          ? positionInRound
          : (numberOfPools - 1 - positionInRound);
        
        const team = teams[i];
        const updated = await teamService.updateTeam(team.id, {
          poolId: createdPools[poolIndex].id
        });
        updatedTeams.push(updated);
      }
      
      const tempPools = divisionPools.filter(p => p.id.includes('_pool_temp_'));
      for (const pool of tempPools) {
        await tournamentService.deletePool(pool.id);
      }
      
      res.status(200).json({
        message: `Successfully distributed ${teams.length} ${division.name} teams across ${numberOfPools} pools`,
        pools: createdPools,
        teams: updatedTeams
      });
    } catch (error: any) {
      console.error("Error auto-distributing teams:", error);
      res.status(500).json({ error: "Failed to auto-distribute teams" });
    }
  });

  app.get("/api/tournaments/:tournamentId/validation-report", requireAdmin, async (req, res) => {
    try {
      const tournamentId = req.params.tournamentId;
      const reportType = (req.query.type as 'post-pool-play' | 'final-convenor') || 'post-pool-play';
      
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const allPools = await tournamentService.getPools(tournamentId);
      const teams = await teamService.getTeams(tournamentId);
      const games = await gameService.getGames(tournamentId);
      
      const pools = allPools.filter(pool => {
        const poolNameLower = pool.name.toLowerCase();
        return (
          !!pool.ageDivisionId &&
          !poolNameLower.includes('unassigned') && 
          !poolNameLower.includes('playoff') &&
          !pool.id.includes('_pool_temp_')
        );
      });
      
      const report = generateValidationReport(tournament, pools, teams, games, reportType);
      
      res.json(report);
    } catch (error) {
      console.error("Error generating validation report:", error);
      res.status(500).json({ error: "Failed to generate validation report" });
    }
  });

  app.post("/api/tournaments/:tournamentId/bulk-import", requireAdmin, async (req, res) => {
    try {
      const { ageDivisions, pools, teams, games } = req.body;
      const tournamentId = req.params.tournamentId;

      await tournamentService.clearTournamentData(tournamentId);

      const existingDivisions = await tournamentService.getAgeDivisions(tournamentId);
      const existingPools = await tournamentService.getPools(tournamentId);
      
      const createdAgeDivisions = await Promise.all(
        ageDivisions.map(async (div: any) => {
          const existing = existingDivisions.find(d => d.id === div.id);
          if (existing) {
            return existing;
          }
          const newDivision = await tournamentService.createAgeDivision({ ...div, tournamentId });
          await autoCreatePoolsForDivision(tournamentId, newDivision.id);
          return newDivision;
        })
      );

      const createdPools = await Promise.all(
        pools.map(async (pool: any) => {
          const existing = existingPools.find(p => p.id === pool.id);
          if (existing) {
            return existing;
          }
          return tournamentService.createPool({ ...pool, tournamentId });
        })
      );

      const createdTeams = await teamService.bulkCreateTeams(
        teams.map((team: any) => ({ ...team, tournamentId }))
      );

      const createdGames = await gameService.bulkCreateGames(
        games.map((game: any) => ({ ...game, tournamentId }))
      );

      res.status(201).json({
        ageDivisions: createdAgeDivisions,
        pools: createdPools,
        teams: createdTeams,
        games: createdGames
      });
    } catch (error) {
      console.error("Error bulk importing data:", error);
      res.status(400).json({ error: "Failed to import data" });
    }
  });

  app.post("/api/tournaments/:tournamentId/import-registrations", requireAdmin, async (req, res) => {
    try {
      const { teams } = req.body;
      const tournamentId = req.params.tournamentId;

      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const createdTeams = await teamService.bulkCreateOrUpdateTeamsFromRegistrations(
        teams.map((team: any) => ({ ...team, tournamentId }))
      );

      res.status(201).json({
        teams: createdTeams,
        message: `Successfully imported ${createdTeams.length} teams`
      });
    } catch (error) {
      console.error("Error importing registrations:", error);
      res.status(400).json({ error: "Failed to import registrations data" });
    }
  });

  app.get("/api/roster/teams/search", async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.json({ success: false, error: "Please provide a search term with at least 2 characters" });
      }

      const { spawn } = await import("child_process");
      const python = spawn("python", ["oba_roster_service.py", "search", query.toString()], { cwd: "server" });
      
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            res.json(result);
          } catch (parseError) {
            console.error("Failed to parse search results:", parseError);
            res.status(500).json({ success: false, error: "Invalid search response format" });
          }
        } else {
          console.error("Python script error:", error);
          res.status(500).json({ success: false, error: "Failed to search teams" });
        }
      });
    } catch (error) {
      console.error("Roster search error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.post("/api/roster/teams/discover", requireAdmin, async (req, res) => {
    try {
      const { startId, endId } = req.body;
      
      if (!startId || !endId) {
        return res.status(400).json({ success: false, error: "Start ID and End ID are required" });
      }

      if (endId - startId > 100) {
        return res.status(400).json({ success: false, error: "Range too large. Maximum 100 teams per discovery" });
      }

      const { spawn } = await import("child_process");
      const python = spawn("python", ["oba_roster_service.py", "discover", startId.toString(), endId.toString()], { cwd: "server" });
      
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            res.json(result);
          } catch (parseError) {
            console.error("Failed to parse discovery results:", parseError);
            res.status(500).json({ success: false, error: "Invalid discovery response format" });
          }
        } else {
          console.error("Python discovery script error:", error);
          res.status(500).json({ success: false, error: "Failed to discover teams" });
        }
      });
    } catch (error) {
      console.error("Team discovery error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.get("/api/roster/teams/cached", async (req, res) => {
    try {
      const { spawn } = await import("child_process");
      const python = spawn("python", ["oba_roster_service.py", "list"], { cwd: "server" });
      
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            res.json(result);
          } catch (parseError) {
            console.error("Failed to parse cached teams:", parseError);
            res.status(500).json({ success: false, error: "Invalid cached teams response format" });
          }
        } else {
          console.error("Python cached teams script error:", error);
          res.status(500).json({ success: false, error: "Failed to get cached teams" });
        }
      });
    } catch (error) {
      console.error("Cached teams error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });
  
  app.get("/api/roster/teams/:teamId", async (req, res) => {
    try {
      const { teamId } = req.params;
      const { noCache } = req.query;
      const { spawn } = await import("child_process");
      
      const args = ["oba_roster_service.py", "roster", teamId];
      if (noCache === "true") args.push("--no-cache");
      
      const python = spawn("python", args, { cwd: "server" });
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            res.json(result);
          } catch (parseError) {
            console.error("Failed to parse roster data:", parseError);
            res.status(500).json({ success: false, error: "Invalid response format" });
          }
        } else {
          console.error("Python script error:", error);
          res.status(500).json({ success: false, error: "Failed to fetch roster" });
        }
      });
    } catch (error) {
      console.error("Roster fetch error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });
  
  app.post("/api/roster/teams/:teamId/import", isAuthenticated, async (req, res) => {
    try {
      const { teamId } = req.params;
      const { tournamentTeamId } = req.body;
      
      if (!tournamentTeamId) {
        return res.status(400).json({ success: false, error: "Tournament team ID required" });
      }
      
      const { spawn } = await import("child_process");
      const python = spawn("python", ["oba_roster_service.py", "roster", teamId], { cwd: "server" });
      
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", async (code) => {
        if (code === 0) {
          try {
            const rosterData = JSON.parse(output);
            
            if (rosterData.success && rosterData.players) {
              await teamService.updateTeamRoster(tournamentTeamId, JSON.stringify(rosterData.players));
              
              res.json({ 
                success: true, 
                message: `Imported ${rosterData.players.length} players from ${rosterData.team_name}`,
                playerCount: rosterData.players.length
              });
            } else {
              res.status(400).json({ 
                success: false, 
                error: rosterData.error || "No roster data available" 
              });
            }
          } catch (parseError) {
            console.error("Failed to parse roster data:", parseError);
            res.status(500).json({ success: false, error: "Invalid response format" });
          }
        } else {
          console.error("Python script error:", error);
          res.status(500).json({ success: false, error: "Failed to fetch roster" });
        }
      });
    } catch (error) {
      console.error("Roster import error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  app.post("/api/tournaments/:tournamentId/populate-test-data", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.params;
      
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const numberOfTeams = tournament.numberOfTeams || 16;
      const numberOfPools = tournament.numberOfPools || 4;
      
      const allCityNames = [
        "Chatham", "Leamington", "Sarnia", "Windsor", "Brantford", "Simcoe", 
        "St. Thomas", "Woodstock", "Welland", "Grimsby", "St. Catharines", 
        "Niagara Falls", "Orangeville", "Caledon", "Bolton", "Shelburne",
        "London", "Kitchener", "Cambridge", "Waterloo", "Guelph", "Barrie",
        "Oshawa", "Hamilton", "Kingston", "Peterborough", "Thunder Bay", "Sudbury"
      ];
      
      const selectedCities = allCityNames.slice(0, numberOfTeams);
      
      const teamsPerPool = Math.floor(numberOfTeams / numberOfPools);
      const extraTeams = numberOfTeams % numberOfPools;
      
      const poolNames = Array.from({ length: numberOfPools }, (_, i) => 
        String.fromCharCode(65 + i)
      );
      
      const ageDivisionId = `${tournamentId}-11u`;
      await tournamentService.createAgeDivision({
        id: ageDivisionId,
        name: "11U",
        tournamentId
      });
      
      const poolIds: Record<string, string> = {};
      const poolTeams: Record<string, string[]> = {};
      let cityIndex = 0;
      
      for (let i = 0; i < numberOfPools; i++) {
        const poolName = poolNames[i];
        const poolId = `${tournamentId}-pool-${poolName.toLowerCase()}`;
        
        await tournamentService.createPool({
          id: poolId,
          name: poolName,
          tournamentId,
          ageDivisionId
        });
        
        poolIds[poolName] = poolId;
        poolTeams[poolName] = [];
        
        const teamCount = teamsPerPool + (i < extraTeams ? 1 : 0);
        for (let j = 0; j < teamCount; j++) {
          const city = selectedCities[cityIndex];
          const teamId = `${tournamentId}-${city.toLowerCase().replace(/\s+/g, '-')}`;
          
          await teamService.createTeam({
            id: teamId,
            name: city,
            city,
            division: "11U",
            tournamentId,
            poolId: poolId
          });
          
          poolTeams[poolName].push(teamId);
          cityIndex++;
        }
      }
      
      let gameNumber = 1;
      let totalPoolGames = 0;
      
      for (const [poolName, teamList] of Object.entries(poolTeams)) {
        const poolId = poolIds[poolName];
        
        for (let i = 0; i < teamList.length; i++) {
          for (let j = i + 1; j < teamList.length; j++) {
            const homeTeamId = teamList[i];
            const awayTeamId = teamList[j];
            
            const homeScore = Math.floor(Math.random() * 8) + 3;
            const awayScore = Math.floor(Math.random() * 8) + 1;
            
            await gameService.createGame({
              id: `${tournamentId}-game-${gameNumber}`,
              tournamentId,
              poolId: poolId,
              homeTeamId,
              awayTeamId,
              homeScore,
              awayScore,
              homeInningsBatted: homeScore > awayScore ? "6.0" : "6.0",
              awayInningsBatted: awayScore > homeScore ? "6.0" : "6.0",
              status: "completed",
              date: tournament.startDate || "2025-11-15",
              time: `${9 + Math.floor((gameNumber - 1) / 4)}:${((gameNumber - 1) % 4) * 15}0`,
              location: `Diamond ${((gameNumber - 1) % 4) + 1}`
            });
            
            gameNumber++;
            totalPoolGames++;
          }
        }
      }
      
      const playoffGames = await playoffService.generatePlayoffBracket(tournamentId, ageDivisionId);
      
      res.json({
        success: true,
        message: "Test data populated successfully including playoff bracket",
        summary: {
          pools: numberOfPools,
          teams: numberOfTeams,
          poolPlayGames: totalPoolGames,
          playoffGames: playoffGames.length
        }
      });
    } catch (error) {
      console.error("Error populating test data:", error);
      res.status(500).json({ error: "Failed to populate test data" });
    }
  });

  app.get('/api/tournaments/organization-settings/games', isAuthenticated, async (req: any, res) => {
    try {
      const { organizationId, startDate, endDate, diamondId } = req.query;
      
      if (!organizationId) {
        return res.status(400).json({ error: "organizationId is required" });
      }
      
      const organizationDiamonds = await diamondService.getDiamonds(organizationId as string);
      const organizationDiamondIds = organizationDiamonds.map(d => d.id);
      
      if (organizationDiamondIds.length === 0) {
        return res.json([]);
      }
      
      const allGames = await gameService.getAllGames();
      
      const filteredGames = allGames.filter(game => {
        if (!game.diamondId) return false;
        
        const isOrgDiamond = organizationDiamondIds.includes(game.diamondId);
        if (!isOrgDiamond) return false;
        
        if (diamondId && game.diamondId !== diamondId) return false;
        
        if (startDate && game.date < (startDate as string)) return false;
        if (endDate && game.date > (endDate as string)) return false;
        
        return true;
      });
      
      res.json(filteredGames);
    } catch (error) {
      console.error("Error fetching tournament games:", error);
      res.status(500).json({ error: "Failed to fetch tournament games" });
    }
  });

  app.get('/api/organizations/:orgId/coordinators', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { role } = req.query;
      
      const coordinators = await organizationService.getOrganizationCoordinators(orgId, role as string | undefined);
      res.json(coordinators);
    } catch (error) {
      console.error("Error fetching coordinators:", error);
      res.status(500).json({ error: "Failed to fetch coordinators" });
    }
  });

  app.post('/api/organizations/:orgId/coordinators', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const validatedData = insertOrganizationCoordinatorSchema.parse(req.body);
      
      const coordinator = await organizationService.upsertOrganizationCoordinator(
        orgId,
        validatedData.role,
        validatedData
      );
      
      res.status(201).json(coordinator);
    } catch (error) {
      console.error("Error creating/updating coordinator:", error);
      res.status(400).json({ error: "Failed to create/update coordinator" });
    }
  });

  app.put('/api/organizations/:orgId/coordinators/:coordinatorId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, coordinatorId } = req.params;
      const validatedData = insertOrganizationCoordinatorSchema.partial().parse(req.body);
      
      const coordinator = await organizationService.updateOrganizationCoordinator(coordinatorId, validatedData, orgId);
      res.json(coordinator);
    } catch (error) {
      console.error("Error updating coordinator:", error);
      res.status(400).json({ error: "Failed to update coordinator" });
    }
  });

  app.delete('/api/organizations/:orgId/coordinators/:coordinatorId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, coordinatorId } = req.params;
      await organizationService.deleteOrganizationCoordinator(coordinatorId, orgId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting coordinator:", error);
      res.status(500).json({ error: "Failed to delete coordinator" });
    }
  });

  app.get('/api/team/update/:token', async (req: any, res) => {
    try {
      const { token } = req.params;

      const team = await teamService.getTeamByManagementToken(token);
      if (!team) {
        return res.status(404).json({ error: "Team not found or invalid token" });
      }

      const tournament = await tournamentService.getTournament(team.tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const organization = await organizationService.getOrganization(tournament.organizationId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      res.json({
        id: team.id,
        name: team.name,
        division: team.division,
        coachFirstName: team.coachFirstName,
        coachLastName: team.coachLastName,
        coachPhone: team.coachPhone,
        managerName: team.managerName,
        managerPhone: team.managerPhone,
        assistantName: team.assistantName,
        assistantPhone: team.assistantPhone,
        tournament: {
          id: tournament.id,
          name: tournament.name,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
      });
    } catch (error) {
      console.error("Error fetching team by token:", error);
      res.status(500).json({ error: "Failed to fetch team information" });
    }
  });

  app.post('/api/team/update/:token', async (req: any, res) => {
    try {
      const { token } = req.params;
      const { managerName, managerPhone, assistantName, assistantPhone } = req.body;

      const team = await teamService.getTeamByManagementToken(token);
      if (!team) {
        return res.status(404).json({ error: "Team not found or invalid token" });
      }

      const updatedTeam = await teamService.updateTeam(team.id, {
        managerName: managerName || null,
        managerPhone: managerPhone || null,
        assistantName: assistantName || null,
        assistantPhone: assistantPhone || null,
      });

      const tournament = await tournamentService.getTournament(team.tournamentId);
      const organization = tournament ? await organizationService.getOrganization(tournament.organizationId) : null;

      if (organization && tournament) {
        const newStaff = [];
        
        if (managerPhone && managerPhone !== team.managerPhone) {
          newStaff.push({
            name: managerName,
            phone: managerPhone,
            role: 'Team Manager',
          });
        }
        
        if (assistantPhone && assistantPhone !== team.assistantPhone) {
          newStaff.push({
            name: assistantName,
            phone: assistantPhone,
            role: 'Assistant Coach',
          });
        }

        for (const staff of newStaff) {
          try {
            await smsService.sendSMS({
              organizationId: organization.id,
              to: staff.phone,
              message: `Welcome! You've been added as ${staff.role} for ${team.name} in the ${tournament.name}. You'll receive tournament updates at this number.`,
            });
          } catch (smsError) {
            console.error(`Failed to send welcome SMS to ${staff.phone}:`, smsError);
          }
        }
      }

      res.json({ 
        success: true, 
        message: "Team staff contacts updated successfully",
        team: {
          id: updatedTeam.id,
          name: updatedTeam.name,
          managerName: updatedTeam.managerName,
          managerPhone: updatedTeam.managerPhone,
          assistantName: updatedTeam.assistantName,
          assistantPhone: updatedTeam.assistantPhone,
        },
      });
    } catch (error) {
      console.error("Error updating team staff contacts:", error);
      res.status(500).json({ error: "Failed to update team information" });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { rosterScraper } = await import('./services/rosterScraper');
    
    app.get("/api/test/scrape-roster/:teamId", requireSuperAdmin, async (req, res) => {
      try {
        const { teamId } = req.params;
        const affiliateId = (req.query.affiliateId as string) || "2111";
        
        console.log(`[Test Route] Scraping roster for team ${teamId}...`);
        const roster = await rosterScraper.scrapeRoster(teamId, affiliateId);
        
        res.json({
          success: true,
          teamId,
          affiliateId,
          playerCount: roster.length,
          roster,
        });
      } catch (error: any) {
        console.error("[Test Route] Scraper error:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to scrape roster",
        });
      }
    });
  }

  const httpServer = createServer(app);

  return httpServer;
}
