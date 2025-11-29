import { Router } from "express";
import { tournamentService } from "../services/tournamentService";
import { organizationService } from "../services/organizationService";
import { userService } from "../services/userService";
import { isAuthenticated, requireAdmin } from "../auth";
import { getUserOrganizationIds, checkTournamentAccess } from "./helpers";
import { 
  insertTournamentSchema, 
  insertAgeDivisionSchema, 
  insertPoolSchema 
} from "@shared/schema";
import { notificationService } from "../lib/notificationService";
import { nanoid } from "nanoid";

const router = Router();

router.get("/public/tournaments", async (req, res) => {
  try {
    let tournaments = await tournamentService.getTournaments();
    
    tournaments = tournaments.filter(t => t.visibility === 'public');
    
    const tournamentsWithOrgs = await Promise.all(
      tournaments.map(async (tournament) => {
        const org = tournament.organizationId 
          ? await organizationService.getOrganization(tournament.organizationId)
          : null;
        
        return {
          id: tournament.id,
          name: tournament.name,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          type: tournament.type,
          primaryColor: tournament.primaryColor,
          secondaryColor: tournament.secondaryColor,
          logoUrl: tournament.logoUrl,
          organization: org ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            logoUrl: org.logoUrl,
          } : null,
        };
      })
    );
    
    res.json(tournamentsWithOrgs);
  } catch (error) {
    console.error("Error fetching public tournaments:", error);
    res.status(500).json({ error: "Failed to fetch public tournaments" });
  }
});

router.get("/tournaments", async (req: any, res) => {
  try {
    let tournaments = await tournamentService.getTournaments();
    
    if (req.user && (req.user as any)) {
      const userId = (req.user as any).id;
      const user = await userService.getUser(userId);
      
      if (user && user.isSuperAdmin) {
      }
      else if (user && user.isAdmin) {
        const userOrgs = await userService.getUserOrganizations(userId);
        const userOrgIds = userOrgs.map(org => org.id);
        tournaments = tournaments.filter(t => userOrgIds.includes(t.organizationId));
      }
      else if (user) {
        const orgIds = new Set<string>();
        
        const acceptedInvites = await organizationService.getAcceptedCoachInvitations(userId);
        acceptedInvites.forEach(inv => orgIds.add(inv.organizationId));
        
        const coordinatorAssignments = await userService.getUserCoordinatorAssignments(userId);
        coordinatorAssignments.forEach(assignment => orgIds.add(assignment.organizationId));
        
        if (orgIds.size > 0) {
          tournaments = tournaments.filter(t => orgIds.has(t.organizationId));
        }
      }
    }
    
    res.json(tournaments);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

router.get("/tournaments/:id", async (req: any, res) => {
  try {
    const tournament = await tournamentService.getTournament(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (req.user && (req.user as any)) {
      const userId = (req.user as any).id;
      const userOrgIds = await getUserOrganizationIds(userId);
      
      if (userOrgIds.size > 0 && !userOrgIds.has(tournament.organizationId)) {
        return res.status(403).json({ error: "Access denied to this tournament" });
      }
    }
    
    res.json(tournament);
  } catch (error) {
    console.error("Error fetching tournament:", error);
    res.status(500).json({ error: "Failed to fetch tournament" });
  }
});

router.post("/tournaments", requireAdmin, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await userService.getUser(userId);
    
    const validatedData = insertTournamentSchema.parse({
      ...req.body,
      createdBy: userId
    });

    if (!user?.isSuperAdmin) {
      const userOrgs = await userService.getUserOrganizations(userId);
      const userOrgIds = userOrgs.map(org => org.id);
      
      if (!userOrgIds.includes(validatedData.organizationId)) {
        return res.status(403).json({ 
          error: "You can only create tournaments for organizations you administer" 
        });
      }
    }

    const tournament = await tournamentService.createTournament(validatedData);

    if (tournament.organizationId && user) {
      const organization = await organizationService.getOrganization(tournament.organizationId);
      if (organization?.adminEmail) {
        const adminName = user.firstName 
          ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
          : user.email || 'Admin';
        
        try {
          await notificationService.sendTournamentEmail({
            organizationId: organization.id,
            organizationName: organization.name,
            organizationLogoUrl: organization.logoUrl || undefined,
            primaryColor: organization.primaryColor || tournament.primaryColor || '#22c55e',
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            startDate: tournament.startDate,
            endDate: tournament.endDate,
            adminName,
            adminEmail: organization.adminEmail,
          });
        } catch (emailError) {
          console.error("Failed to send tournament email:", emailError);
        }
      }
    }

    res.status(201).json(tournament);
  } catch (error) {
    console.error("Error creating tournament:", error);
    res.status(400).json({ error: "Invalid tournament data" });
  }
});

router.put("/tournaments/:id", requireAdmin, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await userService.getUser(userId);
    const tournament = await tournamentService.getTournament(req.params.id);

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (!user?.isSuperAdmin && tournament.createdBy !== userId) {
      return res.status(403).json({ error: "You can only edit tournaments you created" });
    }

    const validatedData = insertTournamentSchema.partial().parse(req.body);
    const updatedTournament = await tournamentService.updateTournament(req.params.id, validatedData);
    res.json(updatedTournament);
  } catch (error) {
    console.error("Error updating tournament:", error);
    res.status(400).json({ error: "Invalid tournament data" });
  }
});

router.delete("/tournaments/:id", requireAdmin, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await userService.getUser(userId);
    const tournament = await tournamentService.getTournament(req.params.id);

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (!user?.isSuperAdmin && tournament.createdBy !== userId) {
      return res.status(403).json({ error: "You can only delete tournaments you created" });
    }

    await tournamentService.deleteTournament(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting tournament:", error);
    res.status(500).json({ error: "Failed to delete tournament" });
  }
});

router.get("/tournaments/:tournamentId/age-divisions", async (req: any, res) => {
  try {
    if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
      return;
    }
    const ageDivisions = await tournamentService.getAgeDivisions(req.params.tournamentId);
    res.json(ageDivisions);
  } catch (error) {
    console.error("Error fetching age divisions:", error);
    res.status(500).json({ error: "Failed to fetch age divisions" });
  }
});

async function autoCreatePoolsForDivision(tournamentId: string, divisionId: string) {
  const tournament = await tournamentService.getTournament(tournamentId);
  if (!tournament) {
    throw new Error("Tournament not found");
  }

  const numberOfPools = tournament.numberOfPools || 2;
  
  const existingPools = await tournamentService.getPools(tournamentId);
  const divisionPools = existingPools.filter(p => p.ageDivisionId === divisionId);
  if (divisionPools.length > 0) {
    console.log(`Pools already exist for division ${divisionId}, skipping auto-creation`);
    return;
  }
  
  function getPoolName(index: number): string {
    if (index < 26) {
      return String.fromCharCode(65 + index);
    }
    const firstLetter = String.fromCharCode(65 + Math.floor(index / 26) - 1);
    const secondLetter = String.fromCharCode(65 + (index % 26));
    return firstLetter + secondLetter;
  }
  
  for (let i = 0; i < numberOfPools; i++) {
    await tournamentService.createPool({
      id: nanoid(),
      name: getPoolName(i),
      tournamentId,
      ageDivisionId: divisionId,
    });
  }
  
  console.log(`Auto-created ${numberOfPools} pools for division ${divisionId}`);
}

router.post("/tournaments/:tournamentId/age-divisions", requireAdmin, async (req, res) => {
  try {
    const validatedData = insertAgeDivisionSchema.parse({
      ...req.body,
      tournamentId: req.params.tournamentId
    });
    const ageDivision = await tournamentService.createAgeDivision(validatedData);
    
    await autoCreatePoolsForDivision(req.params.tournamentId, ageDivision.id);
    
    res.status(201).json(ageDivision);
  } catch (error) {
    console.error("Error creating age division:", error);
    res.status(400).json({ error: "Invalid age division data" });
  }
});

router.put("/age-divisions/:divisionId", requireAdmin, async (req, res) => {
  try {
    const { divisionId } = req.params;
    const updateData = insertAgeDivisionSchema.partial().parse(req.body);
    
    const updated = await tournamentService.updateAgeDivision(divisionId, updateData);
    if (!updated) {
      return res.status(404).json({ error: "Age division not found" });
    }
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating age division:", error);
    res.status(400).json({ error: "Invalid age division data" });
  }
});

router.get("/tournaments/:tournamentId/pools", async (req: any, res) => {
  try {
    if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
      return;
    }
    const pools = await tournamentService.getPools(req.params.tournamentId);
    res.json(pools);
  } catch (error) {
    console.error("Error fetching pools:", error);
    res.status(500).json({ error: "Failed to fetch pools" });
  }
});

router.post("/tournaments/:tournamentId/pools", requireAdmin, async (req, res) => {
  try {
    const validatedData = insertPoolSchema.parse({
      ...req.body,
      tournamentId: req.params.tournamentId
    });
    const pool = await tournamentService.createPool(validatedData);
    res.status(201).json(pool);
  } catch (error) {
    console.error("Error creating pool:", error);
    res.status(400).json({ error: "Invalid pool data" });
  }
});

router.get("/organizations/:slug/tournaments", async (req, res) => {
  try {
    const organization = await organizationService.getOrganizationBySlug(req.params.slug);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    const tournaments = await tournamentService.getTournaments(organization.id);
    res.json(tournaments);
  } catch (error) {
    console.error("Error fetching organization tournaments:", error);
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

export default router;
