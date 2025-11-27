import { db } from "../db";
import { tournamentDiamondAllocations, type InsertTournamentDiamondAllocation } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class AllocationService {
  async getAllocations(tournamentId: string) {
    return await db
      .select()
      .from(tournamentDiamondAllocations)
      .where(eq(tournamentDiamondAllocations.tournamentId, tournamentId))
      .orderBy(tournamentDiamondAllocations.date, tournamentDiamondAllocations.startTime);
  }

  async createAllocation(data: InsertTournamentDiamondAllocation) {
    return await db.insert(tournamentDiamondAllocations).values(data).returning();
  }

  async updateAllocation(id: string, data: Partial<InsertTournamentDiamondAllocation>) {
    return await db
      .update(tournamentDiamondAllocations)
      .set(data)
      .where(eq(tournamentDiamondAllocations.id, id))
      .returning();
  }

  async deleteAllocation(id: string) {
    await db.delete(tournamentDiamondAllocations).where(eq(tournamentDiamondAllocations.id, id));
  }

  async deleteAllForTournament(tournamentId: string) {
    await db
      .delete(tournamentDiamondAllocations)
      .where(eq(tournamentDiamondAllocations.tournamentId, tournamentId));
  }

  async bulkCreate(allocations: InsertTournamentDiamondAllocation[]) {
    return await db.insert(tournamentDiamondAllocations).values(allocations).returning();
  }

  async checkAvailability(diamondId: string, date: string) {
    return await db
      .select()
      .from(tournamentDiamondAllocations)
      .where(
        and(
          eq(tournamentDiamondAllocations.diamondId, diamondId),
          eq(tournamentDiamondAllocations.date, date)
        )
      );
  }

  async getExistingAllocations(tournamentId: string, diamondId: string, date: string) {
    return await db
      .select()
      .from(tournamentDiamondAllocations)
      .where(
        and(
          eq(tournamentDiamondAllocations.tournamentId, tournamentId),
          eq(tournamentDiamondAllocations.diamondId, diamondId),
          eq(tournamentDiamondAllocations.date, date)
        )
      );
  }

  async getAllocationById(id: string, tournamentId: string) {
    const [allocation] = await db
      .select()
      .from(tournamentDiamondAllocations)
      .where(
        and(
          eq(tournamentDiamondAllocations.id, id),
          eq(tournamentDiamondAllocations.tournamentId, tournamentId)
        )
      );
    return allocation;
  }

  checkTimeOverlap(
    newStart: string, 
    newEnd: string, 
    existingStart: string, 
    existingEnd: string
  ): boolean {
    const toMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const newStartMins = toMinutes(newStart);
    const newEndMins = toMinutes(newEnd);
    const existingStartMins = toMinutes(existingStart);
    const existingEndMins = toMinutes(existingEnd);
    
    return newStartMins < existingEndMins && newEndMins > existingStartMins;
  }
}

export const allocationService = new AllocationService();
