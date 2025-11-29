import { Router } from "express";
import { diamondService } from "../services/diamondService";
import { organizationService } from "../services/organizationService";
import { userService } from "../services/userService";
import { isAuthenticated, requireOrgAdmin, requireDiamondBooking } from "../auth";
import { generateICSFile, type CalendarEvent } from "../utils/ics-generator";
import { fromZonedTime } from "date-fns-tz";
import { nanoid } from "nanoid";

const router = Router();

// House League Teams
router.get('/organizations/:orgId/house-league-teams', requireDiamondBooking, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const teams = await diamondService.getHouseLeagueTeams(orgId);
    res.json(teams);
  } catch (error) {
    console.error("Error fetching house league teams:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

router.post('/organizations/:orgId/house-league-teams', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const team = await diamondService.createHouseLeagueTeam({
      ...req.body,
      organizationId: orgId,
    });
    res.status(201).json(team);
  } catch (error) {
    console.error("Error creating house league team:", error);
    res.status(400).json({ error: "Failed to create team" });
  }
});

router.patch('/organizations/:orgId/house-league-teams/:teamId', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, teamId } = req.params;
    const team = await diamondService.updateHouseLeagueTeam(teamId, req.body, orgId);
    res.json(team);
  } catch (error) {
    console.error("Error updating house league team:", error);
    res.status(400).json({ error: "Failed to update team" });
  }
});

router.delete('/organizations/:orgId/house-league-teams/:teamId', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, teamId } = req.params;
    await diamondService.deleteHouseLeagueTeam(teamId, orgId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting house league team:", error);
    res.status(500).json({ error: "Failed to delete team" });
  }
});

// Booking Requests
router.get('/organizations/:orgId/booking-requests', requireDiamondBooking, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { status, teamId, startDate, endDate } = req.query;
    
    const requests = await diamondService.getBookingRequests(orgId, {
      status: status as string | undefined,
      teamId: teamId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    
    res.json(requests);
  } catch (error) {
    console.error("Error fetching booking requests:", error);
    res.status(500).json({ error: "Failed to fetch booking requests" });
  }
});

// Calendar view endpoint with populated team and diamond data
router.get('/organizations/:orgId/booking-requests/calendar/:startDate/:endDate', requireDiamondBooking, async (req: any, res) => {
  try {
    const { orgId, startDate, endDate } = req.params;
    
    const requests = await diamondService.getBookingRequests(orgId, {
      startDate,
      endDate,
    });
    
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const [team, diamond] = await Promise.all([
          diamondService.getHouseLeagueTeam(request.houseLeagueTeamId, orgId),
          request.diamondId ? diamondService.getDiamond(request.diamondId) : null,
        ]);
        
        return {
          ...request,
          team,
          diamond,
        };
      })
    );
    
    res.json(enrichedRequests);
  } catch (error) {
    console.error("Error fetching calendar bookings:", error);
    res.status(500).json({ error: "Failed to fetch calendar bookings" });
  }
});

router.get('/organizations/:orgId/booking-requests/:requestId', requireDiamondBooking, async (req: any, res) => {
  try {
    const { orgId, requestId } = req.params;
    const userId = (req.user as any).id;
    const request = await diamondService.getBookingRequest(requestId, orgId);
    
    if (!request) {
      return res.status(404).json({ error: "Booking request not found" });
    }
    
    const dbUser = await userService.getUser(userId);
    const isOrgAdmin = dbUser?.isSuperAdmin || await organizationService.isOrganizationAdmin(userId, orgId);
    
    if (!isOrgAdmin && request.submittedBy !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const [team, diamond, approvals] = await Promise.all([
      diamondService.getHouseLeagueTeam(request.houseLeagueTeamId, orgId),
      diamondService.getDiamond(request.diamondId),
      diamondService.getBookingApprovals(requestId, orgId),
    ]);
    
    res.json({
      ...request,
      team,
      diamond,
      approvals,
    });
  } catch (error) {
    console.error("Error fetching booking request:", error);
    res.status(500).json({ error: "Failed to fetch booking request" });
  }
});

router.post('/organizations/:orgId/booking-requests', requireDiamondBooking, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const userId = (req.user as any).id;
    
    const team = await diamondService.getHouseLeagueTeam(req.body.houseLeagueTeamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }
    
    if (req.body.diamondId) {
      const isValid = await diamondService.validateDiamondRestriction(
        orgId,
        team.division,
        req.body.diamondId
      );
      
      if (!isValid) {
        return res.status(400).json({ 
          error: `${team.division} teams are not permitted to use this diamond due to size restrictions` 
        });
      }
    }
    
    const request = await diamondService.createBookingRequest({
      ...req.body,
      organizationId: orgId,
      submittedBy: userId,
      status: 'draft',
    });
    
    res.status(201).json(request);
  } catch (error) {
    console.error("Error creating booking request:", error);
    res.status(400).json({ error: "Failed to create booking request" });
  }
});

router.patch('/organizations/:orgId/booking-requests/:requestId', requireDiamondBooking, async (req: any, res) => {
  try {
    const { orgId, requestId } = req.params;
    const request = await diamondService.updateBookingRequest(requestId, req.body, orgId);
    res.json(request);
  } catch (error) {
    console.error("Error updating booking request:", error);
    res.status(400).json({ error: "Failed to update booking request" });
  }
});

// Submit booking request (changes status from draft to submitted)
router.post('/organizations/:orgId/booking-requests/:requestId/submit', requireDiamondBooking, async (req: any, res) => {
  try {
    const { orgId, requestId } = req.params;
    const userId = (req.user as any).id;
    
    const request = await diamondService.submitBookingRequest(requestId, userId, orgId);
    
    const coordinators = await organizationService.getOrganizationCoordinators(orgId, 'select_coordinator');
    const team = await diamondService.getHouseLeagueTeam(request.houseLeagueTeamId);
    const coach = await userService.getUser(userId);
    
    const { notificationService } = await import('../lib/notificationService');
    
    for (const coordinator of coordinators) {
      await notificationService.sendBookingSubmittedNotification({
        organizationId: orgId,
        bookingRequestId: requestId,
        coachName: coach?.email || 'Unknown',
        teamName: team?.name || 'Unknown Team',
        bookingType: request.bookingType,
        date: request.date,
        time: request.startTime,
        diamondName: request.requestedDiamondName || undefined,
        coordinatorEmail: coordinator.email || undefined,
        coordinatorPhone: coordinator.phone || undefined,
      }).catch(err => console.error('Error sending notification:', err));
    }
    
    res.json(request);
  } catch (error) {
    console.error("Error submitting booking request:", error);
    res.status(400).json({ error: "Failed to submit booking request" });
  }
});

// Approve/Decline booking request
router.post('/organizations/:orgId/booking-requests/:requestId/approve', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, requestId } = req.params;
    const userId = (req.user as any).id;
    const { approved, notes } = req.body;
    
    const admins = await organizationService.getOrganizationAdmins(orgId);
    const userAdmin = admins.find(admin => admin.userId === userId);
    
    if (!userAdmin) {
      return res.status(403).json({ error: "User is not an admin of this organization" });
    }
    
    if (userAdmin.role !== 'select_coordinator' && userAdmin.role !== 'diamond_coordinator') {
      return res.status(403).json({ error: "User does not have coordinator permissions" });
    }
    
    const result = await diamondService.processBookingApproval(requestId, {
      approverId: userId,
      approverRole: userAdmin.role,
      decision: approved ? 'approved' : 'declined',
      notes,
    }, orgId);
    
    const request = result.request;
    const team = await diamondService.getHouseLeagueTeam(request.houseLeagueTeamId);
    const coach = await userService.getUser(request.submittedBy);
    const approver = await userService.getUser(userId);
    
    const { notificationService } = await import('../lib/notificationService');
    
    await notificationService.sendApprovalNotification({
      organizationId: orgId,
      bookingRequestId: requestId,
      approved: approved,
      recipientEmail: coach?.email || undefined,
      recipientPhone: coach?.phone || undefined,
      teamName: team?.name || 'Unknown Team',
      date: request.date,
      time: request.startTime,
      approverName: approver?.email || 'Coordinator',
      notes: notes || undefined,
    }).catch(err => console.error('Error sending notification:', err));
    
    if (approved && userAdmin.role === 'diamond_coordinator' && request.requiresUmpire) {
      const uicCoordinators = await organizationService.getOrganizationCoordinators(orgId, 'diamond_coordinator');
      
      for (const uic of uicCoordinators) {
        await notificationService.sendUICNotification({
          organizationId: orgId,
          bookingRequestId: requestId,
          uicEmail: uic.email || undefined,
          uicPhone: uic.phone || undefined,
          teamName: team?.name || 'Unknown Team',
          opponentName: request.opponentName || 'Unknown Opponent',
          date: request.date,
          time: request.startTime,
          diamondName: request.requestedDiamondName || undefined,
        }).catch(err => console.error('Error sending UIC notification:', err));
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error("Error processing booking approval:", error);
    res.status(400).json({ error: "Failed to process approval" });
  }
});

// Cancel booking request
router.post('/organizations/:orgId/booking-requests/:requestId/cancel', requireDiamondBooking, async (req: any, res) => {
  try {
    const { orgId, requestId } = req.params;
    const request = await diamondService.cancelBookingRequest(requestId, orgId);
    res.json(request);
  } catch (error) {
    console.error("Error cancelling booking request:", error);
    res.status(400).json({ error: "Failed to cancel booking request" });
  }
});

// Booking Reports - Diamond Utilization
router.get('/organizations/:orgId/reports/diamond-utilization', isAuthenticated, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { startDate, endDate } = req.query;
    
    const bookings = await diamondService.getBookingRequests(orgId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    
    const diamonds = await diamondService.getDiamonds(orgId);
    
    const utilizationMap = new Map();
    
    for (const diamond of diamonds) {
      utilizationMap.set(diamond.id, {
        diamondId: diamond.id,
        diamondName: diamond.name,
        totalBookings: 0,
        totalHours: 0,
        confirmedBookings: 0,
        confirmedHours: 0,
        peakHours: [],
      });
    }
    
    for (const booking of bookings) {
      if (!booking.diamondId) continue;
      
      const util = utilizationMap.get(booking.diamondId);
      if (!util) continue;
      
      const duration = booking.durationMinutes / 60;
      util.totalBookings++;
      util.totalHours += duration;
      
      if (booking.status === 'diamond_coordinator_approved' || booking.status === 'confirmed') {
        util.confirmedBookings++;
        util.confirmedHours += duration;
      }
    }
    
    res.json(Array.from(utilizationMap.values()));
  } catch (error) {
    console.error("Error fetching diamond utilization:", error);
    res.status(500).json({ error: "Failed to fetch diamond utilization" });
  }
});

// Booking Reports - Division Statistics
router.get('/organizations/:orgId/reports/division-stats', isAuthenticated, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { startDate, endDate } = req.query;
    
    const bookings = await diamondService.getBookingRequests(orgId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    
    const teams = await diamondService.getHouseLeagueTeams(orgId);
    const teamMap = new Map(teams.map(t => [t.id, t]));
    
    const divisionMap = new Map();
    
    for (const booking of bookings) {
      const team = teamMap.get(booking.houseLeagueTeamId);
      if (!team) continue;
      
      const division = team.division;
      if (!divisionMap.has(division)) {
        divisionMap.set(division, {
          division,
          totalRequests: 0,
          confirmedRequests: 0,
          declinedRequests: 0,
          pendingRequests: 0,
          totalHours: 0,
          averageBookingHours: 0,
        });
      }
      
      const stats = divisionMap.get(division);
      stats.totalRequests++;
      stats.totalHours += booking.durationMinutes / 60;
      
      if (booking.status === 'diamond_coordinator_approved' || booking.status === 'confirmed') {
        stats.confirmedRequests++;
      } else if (booking.status === 'declined') {
        stats.declinedRequests++;
      } else if (booking.status === 'submitted' || booking.status === 'select_coordinator_approved') {
        stats.pendingRequests++;
      }
    }
    
    const result = Array.from(divisionMap.values()).map(stats => ({
      ...stats,
      averageBookingHours: stats.totalRequests > 0 ? stats.totalHours / stats.totalRequests : 0,
    }));
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching division stats:", error);
    res.status(500).json({ error: "Failed to fetch division stats" });
  }
});

// Booking Reports - Approval Metrics
router.get('/organizations/:orgId/reports/approval-metrics', isAuthenticated, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { startDate, endDate } = req.query;
    
    const bookings = await diamondService.getBookingRequests(orgId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    
    let totalRequests = bookings.length;
    let confirmedCount = 0;
    let declinedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let totalApprovalTimeMs = 0;
    let approvedRequestsWithTime = 0;
    let selectCoordinatorApprovals = 0;
    let diamondCoordinatorApprovals = 0;
    
    for (const booking of bookings) {
      if (booking.status === 'diamond_coordinator_approved' || booking.status === 'confirmed') {
        confirmedCount++;
        
        if (booking.submittedAt && booking.confirmedAt) {
          const submitted = new Date(booking.submittedAt).getTime();
          const confirmed = new Date(booking.confirmedAt).getTime();
          totalApprovalTimeMs += (confirmed - submitted);
          approvedRequestsWithTime++;
        }
      } else if (booking.status === 'declined') {
        declinedCount++;
      } else if (booking.status === 'submitted' || booking.status === 'select_coordinator_approved') {
        pendingCount++;
        
        if (booking.status === 'select_coordinator_approved') {
          selectCoordinatorApprovals++;
        }
      } else if (booking.status === 'cancelled') {
        cancelledCount++;
      }
      
      if (booking.status === 'diamond_coordinator_approved' || booking.status === 'confirmed') {
        diamondCoordinatorApprovals++;
      }
    }
    
    const averageApprovalTimeHours = approvedRequestsWithTime > 0
      ? (totalApprovalTimeMs / approvedRequestsWithTime) / (1000 * 60 * 60)
      : 0;
    
    const approvalRate = totalRequests > 0 ? confirmedCount / totalRequests : 0;
    
    res.json({
      totalRequests,
      confirmedCount,
      declinedCount,
      pendingCount,
      cancelledCount,
      averageApprovalTimeHours,
      approvalRate,
      selectCoordinatorApprovals,
      diamondCoordinatorApprovals,
    });
  } catch (error) {
    console.error("Error fetching approval metrics:", error);
    res.status(500).json({ error: "Failed to fetch approval metrics" });
  }
});

// Diamond Restrictions
router.get('/organizations/:orgId/diamond-restrictions', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const restrictions = await diamondService.getDiamondRestrictions(orgId);
    res.json(restrictions);
  } catch (error) {
    console.error("Error fetching diamond restrictions:", error);
    res.status(500).json({ error: "Failed to fetch restrictions" });
  }
});

router.post('/organizations/:orgId/diamond-restrictions', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const restriction = await diamondService.createDiamondRestriction({
      ...req.body,
      organizationId: orgId,
    });
    res.status(201).json(restriction);
  } catch (error) {
    console.error("Error creating diamond restriction:", error);
    res.status(400).json({ error: "Failed to create restriction" });
  }
});

router.patch('/organizations/:orgId/diamond-restrictions/:restrictionId', requireOrgAdmin, async (req: any, res) => {
  try {
    const { restrictionId } = req.params;
    const restriction = await diamondService.updateDiamondRestriction(restrictionId, req.body);
    res.json(restriction);
  } catch (error) {
    console.error("Error updating diamond restriction:", error);
    res.status(400).json({ error: "Failed to update restriction" });
  }
});

router.delete('/organizations/:orgId/diamond-restrictions/:restrictionId', requireOrgAdmin, async (req: any, res) => {
  try {
    const { restrictionId } = req.params;
    await diamondService.deleteDiamondRestriction(restrictionId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting diamond restriction:", error);
    res.status(500).json({ error: "Failed to delete restriction" });
  }
});

// Calendar Subscription Endpoints (Public - no auth required)
router.get('/calendar/team/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const team = await diamondService.getHouseLeagueTeamByToken(token);
    if (!team) {
      return res.status(404).send('Calendar not found');
    }
    
    const org = await organizationService.getOrganization(team.organizationId);
    if (!org) {
      return res.status(404).send('Organization not found');
    }
    
    const bookings = await diamondService.getBookingRequests(team.organizationId, {
      teamId: team.id,
      status: 'confirmed',
    });
    
    const timezone = org.timezone || 'America/Toronto';
    
    const events: CalendarEvent[] = bookings.map(booking => {
      const startDateTime = fromZonedTime(`${booking.date} ${booking.startTime}`, timezone);
      const endDateTime = fromZonedTime(`${booking.date} ${booking.endTime}`, timezone);
      
      let summary = `${booking.bookingType.toUpperCase()}: ${team.name}`;
      if (booking.opponentName) {
        summary += ` vs ${booking.opponentName}`;
      }
      
      let description = `${booking.bookingType} for ${team.name}`;
      if (booking.notes) {
        description += `\n\nNotes: ${booking.notes}`;
      }
      
      const location = booking.requestedDiamondName || 'TBD';
      
      return {
        id: booking.id,
        summary,
        description,
        location,
        startDateTime,
        endDateTime,
        status: booking.status,
      };
    });
    
    const icsContent = generateICSFile(
      events,
      org.timezone || 'America/Toronto',
      `${team.name} - ${team.division}`
    );
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${team.name.replace(/\s+/g, '-')}-calendar.ics"`);
    res.send(icsContent);
  } catch (error) {
    console.error("Error generating team calendar:", error);
    res.status(500).send('Error generating calendar');
  }
});

router.get('/calendar/organization/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const org = await organizationService.getOrganizationByToken(token);
    if (!org) {
      return res.status(404).send('Calendar not found');
    }
    
    const bookings = await diamondService.getBookingRequests(org.id, {
      status: 'confirmed',
    });
    
    const teams = await diamondService.getHouseLeagueTeams(org.id);
    const teamsMap = new Map(teams.map(t => [t.id, t]));
    const timezone = org.timezone || 'America/Toronto';
    
    const events: CalendarEvent[] = bookings.map(booking => {
      const startDateTime = fromZonedTime(`${booking.date} ${booking.startTime}`, timezone);
      const endDateTime = fromZonedTime(`${booking.date} ${booking.endTime}`, timezone);
      
      const team = teamsMap.get(booking.houseLeagueTeamId);
      const teamName = team?.name || 'Unknown Team';
      
      let summary = `${booking.bookingType.toUpperCase()}: ${teamName}`;
      if (booking.opponentName) {
        summary += ` vs ${booking.opponentName}`;
      }
      
      let description = `${booking.bookingType} for ${teamName}`;
      if (booking.notes) {
        description += `\n\nNotes: ${booking.notes}`;
      }
      
      const location = booking.requestedDiamondName || 'TBD';
      
      return {
        id: booking.id,
        summary,
        description,
        location,
        startDateTime,
        endDateTime,
        status: booking.status,
      };
    });
    
    const icsContent = generateICSFile(
      events,
      org.timezone || 'America/Toronto',
      `${org.name} - All Bookings`
    );
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${org.name.replace(/\s+/g, '-')}-calendar.ics"`);
    res.send(icsContent);
  } catch (error) {
    console.error("Error generating organization calendar:", error);
    res.status(500).send('Error generating calendar');
  }
});

// Token Generation Endpoints (Admin only)
router.post('/organizations/:orgId/house-league-teams/:teamId/generate-calendar-token', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, teamId } = req.params;
    const token = nanoid(32);
    
    const team = await diamondService.updateHouseLeagueTeam(teamId, { calendarSubscriptionToken: token }, orgId);
    
    res.json({ token: team.calendarSubscriptionToken });
  } catch (error) {
    console.error("Error generating team calendar token:", error);
    res.status(500).json({ error: "Failed to generate calendar token" });
  }
});

router.post('/organizations/:orgId/generate-calendar-token', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const token = nanoid(32);
    
    const org = await organizationService.updateOrganization(orgId, { calendarSubscriptionToken: token });
    
    res.json({ token: org.calendarSubscriptionToken });
  } catch (error) {
    console.error("Error generating organization calendar token:", error);
    res.status(500).json({ error: "Failed to generate calendar token" });
  }
});

// iCal Feed Management (Admin only)
router.get('/organizations/:orgId/ical-feeds', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const feeds = await diamondService.getOrganizationIcalFeeds(orgId);
    res.json(feeds);
  } catch (error) {
    console.error("Error fetching iCal feeds:", error);
    res.status(500).json({ error: "Failed to fetch iCal feeds" });
  }
});

router.post('/organizations/:orgId/ical-feeds', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { name, url, diamondMapping } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: "Name and URL are required" });
    }
    
    const feed = await diamondService.createOrganizationIcalFeed({
      id: nanoid(),
      organizationId: orgId,
      name,
      url,
      diamondMapping: diamondMapping || null,
      lastSyncedAt: null,
      lastSyncError: null,
    });
    
    res.status(201).json(feed);
  } catch (error) {
    console.error("Error creating iCal feed:", error);
    res.status(500).json({ error: "Failed to create iCal feed" });
  }
});

router.put('/organizations/:orgId/ical-feeds/:feedId', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, feedId } = req.params;
    const { name, url, diamondMapping } = req.body;
    
    const feed = await diamondService.updateOrganizationIcalFeed(feedId, {
      name,
      url,
      diamondMapping: diamondMapping || null,
    }, orgId);
    
    res.json(feed);
  } catch (error) {
    console.error("Error updating iCal feed:", error);
    res.status(500).json({ error: "Failed to update iCal feed" });
  }
});

router.delete('/organizations/:orgId/ical-feeds/:feedId', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, feedId } = req.params;
    
    await diamondService.deleteExternalCalendarEventsByFeed(feedId);
    await diamondService.deleteOrganizationIcalFeed(feedId, orgId);
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting iCal feed:", error);
    res.status(500).json({ error: "Failed to delete iCal feed" });
  }
});

router.post('/organizations/:orgId/ical-feeds/:feedId/sync', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, feedId } = req.params;
    
    const org = await organizationService.getOrganization(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const { syncSingleFeed } = await import('../services/calendar-sync');
    const result = await syncSingleFeed(feedId, orgId, org.timezone || 'America/Toronto');
    
    res.json(result);
  } catch (error) {
    console.error("Error syncing iCal feed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to sync iCal feed" });
  }
});

// External Calendar Events (Read-only for now)
router.get('/organizations/:orgId/external-events', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { icalFeedId, startDate, endDate, diamondId } = req.query;
    
    const events = await diamondService.getExternalCalendarEvents(orgId, {
      icalFeedId: icalFeedId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      diamondId: diamondId as string | undefined,
    });
    
    res.json(events);
  } catch (error) {
    console.error("Error fetching external events:", error);
    res.status(500).json({ error: "Failed to fetch external events" });
  }
});

export default router;
