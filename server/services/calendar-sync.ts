import { storage } from '../storage';
import { fetchAndParseICalFeed } from '../utils/ics-parser';
import type { InsertExternalCalendarEvent } from '@shared/schema';

export async function syncAllCalendarFeeds() {
  console.log('[Calendar Sync] Starting sync for all organizations...');
  
  try {
    const allOrgs = await storage.getOrganizations();
    let totalSynced = 0;
    let totalErrors = 0;
    
    for (const org of allOrgs) {
      try {
        const feeds = await storage.getOrganizationIcalFeeds(org.id);
        
        if (feeds.length === 0) {
          continue;
        }
        
        console.log(`[Calendar Sync] Syncing ${feeds.length} feed(s) for organization: ${org.name}`);
        
        for (const feed of feeds) {
          try {
            await syncSingleFeed(feed.id, org.id, org.timezone || 'America/Toronto');
            totalSynced++;
          } catch (error) {
            console.error(`[Calendar Sync] Error syncing feed ${feed.id}:`, error);
            totalErrors++;
            
            await storage.updateOrganizationIcalFeed(feed.id, {
              lastSyncError: error instanceof Error ? error.message : 'Unknown error',
            }, org.id);
          }
        }
      } catch (error) {
        console.error(`[Calendar Sync] Error processing organization ${org.id}:`, error);
        totalErrors++;
      }
    }
    
    console.log(`[Calendar Sync] Completed: ${totalSynced} feeds synced, ${totalErrors} errors`);
  } catch (error) {
    console.error('[Calendar Sync] Fatal error during sync:', error);
    throw error;
  }
}

export async function syncSingleFeed(feedId: string, organizationId: string, timezone: string) {
  const feed = await storage.getOrganizationIcalFeed(feedId, organizationId);
  
  if (!feed) {
    throw new Error(`Feed ${feedId} not found`);
  }
  
  console.log(`[Calendar Sync] Fetching feed: ${feed.url}`);
  
  const events = await fetchAndParseICalFeed(feed.url, timezone);
  
  console.log(`[Calendar Sync] Parsed ${events.length} events from feed ${feedId}`);
  
  let upsertedCount = 0;
  let errorCount = 0;
  
  for (const event of events) {
    try {
      const externalEvent: InsertExternalCalendarEvent = {
        organizationId,
        icalFeedId: feedId,
        externalEventId: event.uid,
        title: event.summary,
        description: event.description || null,
        location: event.location || null,
        diamondId: mapLocationToDiamond(event.location, feed.diamondMapping),
        startDate: event.startDate,
        startTime: event.startTime || null,
        endDate: event.endDate,
        endTime: event.endTime || null,
        lastSyncedAt: new Date(),
      };
      
      await storage.upsertExternalCalendarEvent(externalEvent);
      upsertedCount++;
    } catch (error) {
      console.error(`[Calendar Sync] Error upserting event ${event.uid}:`, error);
      errorCount++;
    }
  }
  
  await storage.updateOrganizationIcalFeed(feedId, {
    lastSyncedAt: new Date(),
    lastSyncError: errorCount > 0 ? `${errorCount} events failed to sync` : null,
  }, organizationId);
  
  console.log(`[Calendar Sync] Feed ${feedId}: ${upsertedCount} events upserted, ${errorCount} errors`);
  
  return { upsertedCount, errorCount };
}

function mapLocationToDiamond(location: string, diamondMapping: Record<string, string> | null): string | null {
  if (!location || !diamondMapping) {
    return null;
  }
  
  const normalizedLocation = location.toLowerCase().trim();
  
  for (const [keyword, diamondId] of Object.entries(diamondMapping)) {
    if (normalizedLocation.includes(keyword.toLowerCase())) {
      return diamondId;
    }
  }
  
  return null;
}

let syncInterval: NodeJS.Timeout | null = null;

export function startCalendarSyncScheduler() {
  if (syncInterval) {
    console.log('[Calendar Sync] Scheduler already running');
    return;
  }
  
  const SYNC_INTERVAL_MS = 8 * 60 * 60 * 1000;
  
  console.log('[Calendar Sync] Starting scheduler (8-hour interval)');
  
  syncAllCalendarFeeds().catch(error => {
    console.error('[Calendar Sync] Initial sync failed:', error);
  });
  
  syncInterval = setInterval(() => {
    syncAllCalendarFeeds().catch(error => {
      console.error('[Calendar Sync] Scheduled sync failed:', error);
    });
  }, SYNC_INTERVAL_MS);
}

export function stopCalendarSyncScheduler() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Calendar Sync] Scheduler stopped');
  }
}
