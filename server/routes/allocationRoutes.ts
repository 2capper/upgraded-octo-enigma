import { Router } from "express";
import { allocationService } from "../services/allocationService";
import { insertTournamentDiamondAllocationSchema } from "@shared/schema";
import { nanoid } from "nanoid";

const router = Router();

router.get("/tournaments/:tournamentId/allocations", async (req, res) => {
  try {
    const allocations = await allocationService.getAllocations(req.params.tournamentId);
    res.json(allocations);
  } catch (error) {
    console.error("Error fetching allocations:", error);
    res.status(500).json({ error: "Failed to fetch allocations" });
  }
});

router.post("/tournaments/:tournamentId/allocations", async (req: any, res) => {
  try {
    const { tournamentId } = req.params;
    
    const validatedData = insertTournamentDiamondAllocationSchema.parse({
      ...req.body,
      id: req.body.id || nanoid(),
      tournamentId
    });

    const existingAllocations = await allocationService.getExistingAllocations(
      tournamentId,
      validatedData.diamondId,
      validatedData.date
    );

    for (const existing of existingAllocations) {
      if (allocationService.checkTimeOverlap(
        validatedData.startTime,
        validatedData.endTime,
        existing.startTime,
        existing.endTime
      )) {
        return res.status(409).json({
          error: `This time slot overlaps with an existing allocation (${existing.startTime}-${existing.endTime})`
        });
      }
    }

    const [newAllocation] = await allocationService.createAllocation(validatedData);
    res.status(201).json(newAllocation);
  } catch (error: any) {
    console.error("Error creating allocation:", error);
    if (error.errors) {
      return res.status(400).json({ error: "Invalid allocation data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create allocation" });
  }
});

router.put("/tournaments/:tournamentId/allocations/:allocationId", async (req: any, res) => {
  try {
    const { tournamentId, allocationId } = req.params;

    const existingAllocation = await allocationService.getAllocationById(allocationId, tournamentId);
    if (!existingAllocation) {
      return res.status(404).json({ error: "Allocation not found" });
    }

    const updateData = {
      diamondId: req.body.diamondId ?? existingAllocation.diamondId,
      date: req.body.date ?? existingAllocation.date,
      startTime: req.body.startTime ?? existingAllocation.startTime,
      endTime: req.body.endTime ?? existingAllocation.endTime,
      divisionId: req.body.divisionId !== undefined ? req.body.divisionId : existingAllocation.divisionId,
    };

    const otherAllocations = await allocationService.getExistingAllocations(
      tournamentId,
      updateData.diamondId,
      updateData.date
    );

    for (const existing of otherAllocations) {
      if (existing.id === allocationId) continue;
      if (allocationService.checkTimeOverlap(
        updateData.startTime,
        updateData.endTime,
        existing.startTime,
        existing.endTime
      )) {
        return res.status(409).json({
          error: `This time slot overlaps with an existing allocation (${existing.startTime}-${existing.endTime})`
        });
      }
    }

    const [updatedAllocation] = await allocationService.updateAllocation(allocationId, updateData);
    res.json(updatedAllocation);
  } catch (error) {
    console.error("Error updating allocation:", error);
    res.status(500).json({ error: "Failed to update allocation" });
  }
});

router.delete("/tournaments/:tournamentId/allocations/:allocationId", async (req: any, res) => {
  try {
    const { tournamentId, allocationId } = req.params;

    const existingAllocation = await allocationService.getAllocationById(allocationId, tournamentId);
    if (!existingAllocation) {
      return res.status(404).json({ error: "Allocation not found" });
    }

    await allocationService.deleteAllocation(allocationId);
    res.json({ message: "Allocation deleted successfully" });
  } catch (error) {
    console.error("Error deleting allocation:", error);
    res.status(500).json({ error: "Failed to delete allocation" });
  }
});

router.post("/tournaments/:tournamentId/allocations/bulk", async (req: any, res) => {
  try {
    const { tournamentId } = req.params;
    const { allocations } = req.body;

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: "Allocations array is required" });
    }

    const validatedAllocations = allocations.map((alloc: any) =>
      insertTournamentDiamondAllocationSchema.parse({
        ...alloc,
        id: alloc.id || nanoid(),
        tournamentId
      })
    );

    const createdAllocations = await allocationService.bulkCreate(validatedAllocations);
    res.status(201).json({
      message: `Created ${createdAllocations.length} allocations`,
      allocations: createdAllocations
    });
  } catch (error: any) {
    console.error("Error bulk creating allocations:", error);
    if (error.errors) {
      return res.status(400).json({ error: "Invalid allocation data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create allocations" });
  }
});

router.delete("/tournaments/:tournamentId/allocations", async (req: any, res) => {
  try {
    const { tournamentId } = req.params;
    await allocationService.deleteAllForTournament(tournamentId);
    res.json({ message: "All allocations cleared" });
  } catch (error) {
    console.error("Error clearing allocations:", error);
    res.status(500).json({ error: "Failed to clear allocations" });
  }
});

export default router;
