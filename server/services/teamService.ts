import { db } from "../db";
import { 
  teams,
  pools,
  ageDivisions,
  type Team,
  type InsertTeam,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { withRetry } from "../dbRetry";

export class TeamService {
  async getTeams(tournamentId: string): Promise<Team[]> {
    const allTeams = await db.select().from(teams).where(eq(teams.tournamentId, tournamentId));
    
    // Filter out placeholder teams for playoff games
    const placeholderPatterns = [
      /^Winner\s+Pool/i,
      /^Loser\s+Pool/i,
      /^Runner-up\s+Pool/i,
      /^Winner\s+of/i,
      /^Loser\s+of/i,
      /^Runner-up\s+of/i,
      /^TBD/i,
      /^To\s+be\s+determined/i,
      /^seed$/i,
      /\bseed\b/i
    ];
    
    return allTeams.filter(team => {
      return !placeholderPatterns.some(pattern => pattern.test(team.name));
    });
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [result] = await db.insert(teams).values(team).returning();
    return result;
  }

  async updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team> {
    return await withRetry(async () => {
      const [result] = await db.update(teams).set(team).where(eq(teams.id, id)).returning();
      return result;
    });
  }

  async updateTeamRoster(id: string, rosterData: string): Promise<Team> {
    const [result] = await db.update(teams)
      .set({ rosterData })
      .where(eq(teams.id, id))
      .returning();
    return result;
  }

  async deleteTeam(id: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  async bulkCreateTeams(teamsList: InsertTeam[]): Promise<Team[]> {
    if (teamsList.length === 0) return [];
    
    const createdTeams: Team[] = [];
    
    for (const teamData of teamsList) {
      const existingTeams = await db.select().from(teams)
        .where(and(
          eq(teams.name, teamData.name),
          eq(teams.tournamentId, teamData.tournamentId)
        ));
      
      if (existingTeams.length > 0) {
        const [updatedTeam] = await db.update(teams)
          .set({
            poolId: teamData.poolId,
            division: teamData.division,
          })
          .where(eq(teams.id, existingTeams[0].id))
          .returning();
        
        createdTeams.push(updatedTeam);
      } else {
        const [newTeam] = await db.insert(teams).values(teamData).returning();
        createdTeams.push(newTeam);
      }
    }
    
    return createdTeams;
  }

  async bulkCreateOrUpdateTeamsFromRegistrations(teamsList: any[]): Promise<Team[]> {
    if (teamsList.length === 0) return [];
    
    const createdTeams: Team[] = [];
    
    for (const teamData of teamsList) {
      const tempPoolId = `${teamData.tournamentId}_pool_temp_${teamData.division.replace(/\s+/g, '-')}`;
      
      let pool = await db.select().from(pools).where(eq(pools.id, tempPoolId));
      if (pool.length === 0) {
        const tempDivisionId = `${teamData.tournamentId}_div_${teamData.division.replace(/\s+/g, '-')}`;
        let division = await db.select().from(ageDivisions).where(eq(ageDivisions.id, tempDivisionId));
        
        if (division.length === 0) {
          await db.insert(ageDivisions).values({
            id: tempDivisionId,
            name: teamData.division,
            tournamentId: teamData.tournamentId
          });
        }
        
        await db.insert(pools).values({
          id: tempPoolId,
          name: 'Unassigned',
          tournamentId: teamData.tournamentId,
          ageDivisionId: tempDivisionId
        });
      }
      
      const existingTeams = await db.select().from(teams)
        .where(and(
          eq(teams.name, teamData.name),
          eq(teams.tournamentId, teamData.tournamentId)
        ));
      
      if (existingTeams.length > 0) {
        const [updatedTeam] = await db.update(teams)
          .set({
            coachFirstName: teamData.coachFirstName,
            coachLastName: teamData.coachLastName,
            coachEmail: teamData.coachEmail,
            phone: teamData.phone,
            teamNumber: teamData.teamNumber,
            rosterLink: teamData.rosterLink,
            registrationStatus: teamData.registrationStatus,
            paymentStatus: teamData.paymentStatus,
            division: teamData.division,
          })
          .where(eq(teams.id, existingTeams[0].id))
          .returning();
        
        createdTeams.push(updatedTeam);
      } else {
        const teamId = `${teamData.tournamentId}_team_${teamData.division}-${teamData.name.replace(/\s+/g, '-')}`;
        const [newTeam] = await db.insert(teams).values({
          id: teamId,
          name: teamData.name,
          division: teamData.division,
          coach: `${teamData.coachFirstName} ${teamData.coachLastName}`,
          coachFirstName: teamData.coachFirstName,
          coachLastName: teamData.coachLastName,
          coachEmail: teamData.coachEmail,
          phone: teamData.phone,
          teamNumber: teamData.teamNumber,
          rosterLink: teamData.rosterLink,
          tournamentId: teamData.tournamentId,
          poolId: tempPoolId,
          registrationStatus: teamData.registrationStatus,
          paymentStatus: teamData.paymentStatus,
        }).returning();
        
        createdTeams.push(newTeam);
      }
    }
    
    return createdTeams;
  }
}

export const teamService = new TeamService();
