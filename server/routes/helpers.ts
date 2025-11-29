import { userService } from "../services/userService";
import { organizationService } from "../services/organizationService";
import { tournamentService } from "../services/tournamentService";

export async function getUserOrganizationIds(userId: string): Promise<Set<string>> {
  const user = await userService.getUser(userId);
  const orgIds = new Set<string>();
  
  if (!user) {
    return orgIds;
  }
  
  if (user.isSuperAdmin) {
    const allOrgs = await organizationService.getOrganizations();
    allOrgs.forEach(org => orgIds.add(org.id));
    return orgIds;
  }
  
  if (user.isAdmin) {
    const adminOrgs = await userService.getUserOrganizations(userId);
    adminOrgs.forEach(org => orgIds.add(org.id));
  }
  
  const coachInvites = await organizationService.getAcceptedCoachInvitations(userId);
  coachInvites.forEach(inv => orgIds.add(inv.organizationId));
  
  const coordinatorAssignments = await userService.getUserCoordinatorAssignments(userId);
  coordinatorAssignments.forEach(assignment => orgIds.add(assignment.organizationId));
  
  return orgIds;
}

export async function checkTournamentAccess(req: any, res: any, tournamentId: string): Promise<boolean> {
  const tournament = await tournamentService.getTournament(tournamentId);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return false;
  }
  
  if (req.user && req.isAuthenticated()) {
    const user = req.user as any;
    const userId = user.id;
    const userOrgIds = await getUserOrganizationIds(userId);
    
    if (!userOrgIds.has(tournament.organizationId)) {
      res.status(403).json({ error: "Access denied to this tournament" });
      return false;
    }
  }
  
  return true;
}
