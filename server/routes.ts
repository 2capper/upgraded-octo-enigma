import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertTournamentSchema, 
  insertAgeDivisionSchema, 
  insertPoolSchema, 
  insertTeamSchema, 
  insertGameSchema 
} from "@shared/schema";
import { sessionConfig, requireAdmin, verifyPassword, hashPassword, checkAdminExists, createInitialAdmin } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply session middleware
  app.use(sessionConfig);
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Login attempt - Environment:", process.env.NODE_ENV);
      console.log("Session ID before login:", req.sessionID);
      
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      console.log("Looking for user:", username);
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log("User not found:", username);
        // Check if any users exist at all
        const userCount = await storage.getUserCount();
        console.log("Total users in database:", userCount);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      console.log("User found, verifying password");
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        console.log("Password verification failed");
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      req.session.isAdmin = user.id === 1; // First user is admin
      
      console.log("Session data set:", { userId: req.session.userId, isAdmin: req.session.isAdmin });
      
      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }
        
        console.log("Session saved successfully, ID:", req.sessionID);
        
        res.json({ 
          success: true, 
          user: { 
            id: user.id, 
            username: user.username,
            isAdmin: user.id === 1
          } 
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });
  
  app.get("/api/auth/check", (req, res) => {
    console.log("Auth check - Session ID:", req.sessionID);
    console.log("Auth check - Session data:", req.session);
    console.log("Auth check - Cookie header:", req.headers.cookie);
    
    if (req.session.userId) {
      res.json({ 
        authenticated: true, 
        userId: req.session.userId,
        isAdmin: req.session.isAdmin || false
      });
    } else {
      res.json({ authenticated: false });
    }
  });
  
  // Setup route - create initial admin if doesn't exist
  app.post("/api/auth/setup", async (req, res) => {
    try {
      const adminExists = await checkAdminExists();
      if (adminExists) {
        return res.status(400).json({ error: "Admin already exists" });
      }
      
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      await createInitialAdmin(password);
      res.json({ success: true, message: "Admin user created" });
    } catch (error) {
      console.error("Setup error:", error);
      res.status(500).json({ error: "Setup failed" });
    }
  });

  // Diagnostic route to check user status
  app.get("/api/auth/diagnostic", async (req, res) => {
    try {
      const userCount = await storage.getUserCount();
      const adminExists = await checkAdminExists();
      
      res.json({
        userCount,
        adminExists,
        sessionStore: process.env.DATABASE_URL ? "PostgreSQL" : "Memory",
        environment: process.env.NODE_ENV || "development"
      });
    } catch (error) {
      console.error("Diagnostic error:", error);
      res.status(500).json({ error: "Diagnostic check failed" });
    }
  });
  // Tournament routes
  app.get("/api/tournaments", async (req, res) => {
    try {
      const tournaments = await storage.getTournaments();
      res.json(tournaments);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const tournament = await storage.getTournament(req.params.id);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      res.json(tournament);
    } catch (error) {
      console.error("Error fetching tournament:", error);
      res.status(500).json({ error: "Failed to fetch tournament" });
    }
  });

  app.post("/api/tournaments", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTournamentSchema.parse(req.body);
      const tournament = await storage.createTournament(validatedData);
      res.status(201).json(tournament);
    } catch (error) {
      console.error("Error creating tournament:", error);
      res.status(400).json({ error: "Invalid tournament data" });
    }
  });

  app.put("/api/tournaments/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTournamentSchema.partial().parse(req.body);
      const tournament = await storage.updateTournament(req.params.id, validatedData);
      res.json(tournament);
    } catch (error) {
      console.error("Error updating tournament:", error);
      res.status(400).json({ error: "Invalid tournament data" });
    }
  });

  app.delete("/api/tournaments/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteTournament(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tournament:", error);
      res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  // Age Division routes
  app.get("/api/tournaments/:tournamentId/age-divisions", async (req, res) => {
    try {
      const ageDivisions = await storage.getAgeDivisions(req.params.tournamentId);
      res.json(ageDivisions);
    } catch (error) {
      console.error("Error fetching age divisions:", error);
      res.status(500).json({ error: "Failed to fetch age divisions" });
    }
  });

  app.post("/api/tournaments/:tournamentId/age-divisions", async (req, res) => {
    try {
      const validatedData = insertAgeDivisionSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const ageDivision = await storage.createAgeDivision(validatedData);
      res.status(201).json(ageDivision);
    } catch (error) {
      console.error("Error creating age division:", error);
      res.status(400).json({ error: "Invalid age division data" });
    }
  });

  // Pool routes
  app.get("/api/tournaments/:tournamentId/pools", async (req, res) => {
    try {
      const pools = await storage.getPools(req.params.tournamentId);
      res.json(pools);
    } catch (error) {
      console.error("Error fetching pools:", error);
      res.status(500).json({ error: "Failed to fetch pools" });
    }
  });

  app.post("/api/tournaments/:tournamentId/pools", async (req, res) => {
    try {
      const validatedData = insertPoolSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const pool = await storage.createPool(validatedData);
      res.status(201).json(pool);
    } catch (error) {
      console.error("Error creating pool:", error);
      res.status(400).json({ error: "Invalid pool data" });
    }
  });

  // Team routes
  app.get("/api/tournaments/:tournamentId/teams", async (req, res) => {
    try {
      const teams = await storage.getTeams(req.params.tournamentId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.post("/api/tournaments/:tournamentId/teams", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTeamSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const team = await storage.createTeam(validatedData);
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(400).json({ error: "Invalid team data" });
    }
  });

  app.put("/api/teams/:id", requireAdmin, async (req, res) => {
    try {
      // Handle both direct data and wrapped data formats
      const updateData = req.body.data || req.body;
      console.log("Team update request body:", req.body);
      console.log("Update data to use:", updateData);
      
      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No data provided for update" });
      }
      
      const team = await storage.updateTeam(req.params.id, updateData);
      res.json(team);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(400).json({ error: "Failed to update team" });
    }
  });

  // Roster import endpoints
  // Get all affiliates with their organizations
  app.get("/api/affiliates", requireAdmin, async (req, res) => {
    try {
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/roster_scraper.py",
        "get_affiliates"
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to get affiliates" });
        }
        
        try {
          const data = JSON.parse(result.trim());
          res.json(data);
        } catch (e) {
          console.error("Failed to parse affiliates:", e);
          res.status(500).json({ error: "Failed to process affiliates" });
        }
      });
    } catch (error) {
      console.error("Error getting affiliates:", error);
      res.status(500).json({ error: "Failed to get affiliates" });
    }
  });

  // Get teams for a specific organization and division
  app.post("/api/organizations/:organization/teams", requireAdmin, async (req, res) => {
    try {
      const { organization } = req.params;
      const { affiliateNumber, division } = req.body;
      
      if (!affiliateNumber || !division) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/roster_scraper.py",
        "get_organization_teams",
        affiliateNumber,
        organization,
        division
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to get organization teams" });
        }
        
        try {
          const data = JSON.parse(result.trim());
          res.json(data);
        } catch (e) {
          console.error("Failed to parse organization teams:", e);
          res.status(500).json({ error: "Failed to process organization teams" });
        }
      });
    } catch (error) {
      console.error("Error getting organization teams:", error);
      res.status(500).json({ error: "Failed to get organization teams" });
    }
  });

  app.post("/api/teams/:teamId/roster/search", requireAdmin, async (req, res) => {
    try {
      const { affiliate, season, division, teamName } = req.body;
      
      if (!affiliate || !season || !division || !teamName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Call Python scraper
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/roster_scraper.py",
        "search",
        affiliate,
        season,
        division,
        teamName
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error code:", code);
          console.error("Python script stderr:", error);
          console.error("Python script stdout:", result);
          return res.status(500).json({ error: "Failed to search for team" });
        }
        
        try {
          // Clean the output in case there are extra whitespaces or newlines
          const cleanedResult = result.trim();
          const data = JSON.parse(cleanedResult);
          res.json(data);
        } catch (e) {
          console.error("Failed to parse JSON result:", e);
          console.error("Raw stdout output:", result);
          console.error("Raw stderr output:", error);
          console.error("Result length:", result.length);
          console.error("First 100 chars:", result.substring(0, 100));
          res.status(500).json({ error: "Failed to process search results" });
        }
      });
    } catch (error) {
      console.error("Error searching for roster:", error);
      res.status(500).json({ error: "Failed to search for roster" });
    }
  });

  app.post("/api/teams/:teamId/roster/import", requireAdmin, async (req, res) => {
    try {
      const { teamUrl } = req.body;
      const { teamId } = req.params;
      
      if (!teamUrl) {
        return res.status(400).json({ error: "Team URL required" });
      }

      // Call Python scraper to get roster
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/roster_scraper.py",
        "import",
        teamUrl
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", async (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to import roster" });
        }
        
        try {
          console.log("Python script output:", result);
          const data = JSON.parse(result);
          console.log("Parsed data:", data);
          
          if (data.success && data.roster) {
            // Ensure we have players data
            const players = data.roster.players || [];
            console.log(`Found ${players.length} players`);
            
            // Update team with roster link and data
            const updateData: any = {};
            if (teamUrl) {
              updateData.rosterLink = teamUrl;
            }
            if (players.length > 0) {
              updateData.rosterData = JSON.stringify(players);
            }
            
            console.log("Update data:", updateData);
            
            if (Object.keys(updateData).length > 0) {
              const team = await storage.updateTeam(teamId, updateData);
              res.json({ 
                success: true, 
                team, 
                roster: data.roster,
                player_count: players.length 
              });
            } else {
              res.status(400).json({ error: "No data to update" });
            }
          } else {
            res.status(400).json({ error: data.error || "Failed to import roster" });
          }
        } catch (e) {
          console.error("Failed to parse result:", e);
          console.error("Raw result:", result);
          res.status(500).json({ error: "Failed to process import results" });
        }
      });
    } catch (error) {
      console.error("Error importing roster:", error);
      res.status(500).json({ error: "Failed to import roster" });
    }
  });

  app.delete("/api/teams/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(400).json({ error: "Failed to delete team" });
    }
  });

  // Helper endpoint to populate team data fields
  app.post("/api/teams/:id/populate-data", requireAdmin, async (req, res) => {
    try {
      const teamId = req.params.id;
      const { teamName } = req.body;
      
      // Generate suggested data based on team name
      const formattedTeamName = teamName.toLowerCase().replace(/\s+/g, '-');
      const rosterLink = `https://playoba.ca/stats/${formattedTeamName}`;
      
      // For now, we'll leave the other fields for manual entry
      // In the future, this could be extended to fetch data from external sources
      const suggestedData = {
        rosterLink,
        pitchCountAppName: '', // To be filled manually
        pitchCountName: '',    // To be filled manually
        gameChangerName: ''    // To be filled manually
      };
      
      // Update the team with the suggested data
      const updatedTeam = await storage.updateTeam(teamId, suggestedData);
      
      res.json({
        team: updatedTeam,
        suggestions: suggestedData
      });
    } catch (error) {
      console.error("Error populating team data:", error);
      res.status(400).json({ error: "Failed to populate team data" });
    }
  });

  // Game routes
  app.get("/api/tournaments/:tournamentId/games", async (req, res) => {
    try {
      const games = await storage.getGames(req.params.tournamentId);
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.post("/api/tournaments/:tournamentId/games", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertGameSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const game = await storage.createGame(validatedData);
      res.status(201).json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(400).json({ error: "Invalid game data" });
    }
  });

  app.put("/api/games/:id", async (req, res) => {
    try {
      const game = await storage.updateGame(req.params.id, req.body);
      res.json(game);
    } catch (error) {
      console.error("Error updating game:", error);
      res.status(400).json({ error: "Failed to update game" });
    }
  });

  app.delete("/api/games/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteGame(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting game:", error);
      res.status(400).json({ error: "Failed to delete game" });
    }
  });

  // Bulk operations for data import
  app.post("/api/tournaments/:tournamentId/bulk-import", requireAdmin, async (req, res) => {
    try {
      const { ageDivisions, pools, teams, games } = req.body;
      const tournamentId = req.params.tournamentId;

      // Clear existing data
      await storage.clearTournamentData(tournamentId);

      // Insert new data in order
      const createdAgeDivisions = await Promise.all(
        ageDivisions.map((div: any) => storage.createAgeDivision({ ...div, tournamentId }))
      );

      const createdPools = await Promise.all(
        pools.map((pool: any) => storage.createPool({ ...pool, tournamentId }))
      );

      const createdTeams = await storage.bulkCreateTeams(
        teams.map((team: any) => ({ ...team, tournamentId }))
      );

      const createdGames = await storage.bulkCreateGames(
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

  const httpServer = createServer(app);

  return httpServer;
}
