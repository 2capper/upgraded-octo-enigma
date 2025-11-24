import { db } from "../db";
import { featureFlags, organizationFeatureFlags } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { log } from "../vite";

const REQUIRED_FEATURE_FLAGS = [
  {
    featureKey: 'tournaments',
    displayName: 'Tournament Management',
    description: 'Create and manage baseball tournaments',
    isEnabled: true,
    icon: 'Trophy',
  },
  {
    featureKey: 'teams',
    displayName: 'Team Management',
    description: 'Manage house league teams and rosters',
    isEnabled: false,
    icon: 'Users',
  },
  {
    featureKey: 'booking',
    displayName: 'Diamond Booking',
    description: 'Calendar, requests, and approvals for diamond booking',
    isEnabled: false,
    icon: 'Calendar',
  },
  {
    featureKey: 'sms',
    displayName: 'SMS Communications',
    description: 'Send messages to coaches and teams',
    isEnabled: true,
    icon: 'MessageSquare',
  },
  {
    featureKey: 'weather',
    displayName: 'Weather Dashboard',
    description: 'Monitor game weather and safety alerts',
    isEnabled: true,
    icon: 'Cloud',
  },
  {
    featureKey: 'reports',
    displayName: 'Reports & Analytics',
    description: 'View usage and statistics',
    isEnabled: false,
    icon: 'BarChart3',
  },
] as const;

const FOREST_GLADE_ENABLED_FEATURES = ['teams', 'booking', 'reports'] as const;

export async function bootstrapFeatureFlags() {
  log("🚀 Bootstrapping feature flags...");

  try {
    for (const flag of REQUIRED_FEATURE_FLAGS) {
      const [existing] = await db.select()
        .from(featureFlags)
        .where(eq(featureFlags.featureKey, flag.featureKey));

      if (existing) {
        await db.update(featureFlags)
          .set({
            displayName: flag.displayName,
            description: flag.description,
            isEnabled: flag.isEnabled,
            icon: flag.icon,
            updatedAt: new Date(),
          })
          .where(eq(featureFlags.featureKey, flag.featureKey));
        log(`  ✓ Updated feature flag: ${flag.featureKey}`);
      } else {
        await db.insert(featureFlags).values({
          featureKey: flag.featureKey,
          displayName: flag.displayName,
          description: flag.description,
          isEnabled: flag.isEnabled,
          icon: flag.icon,
        });
        log(`  ✓ Created feature flag: ${flag.featureKey}`);
      }
    }

    const forestGladeId = process.env.FOREST_GLADE_ORG_ID || '3db7d870-4aab-4e13-af27-c0f76a0e2ade';
    const [forestGlade] = await db.query.organizations.findMany({
      where: (orgs, { eq }) => eq(orgs.id, forestGladeId),
    });

    if (!forestGlade) {
      log(`  ⚠️  Warning: Forest Glade organization not found (ID: ${forestGladeId})`);
    }

    const allOrgs = await db.query.organizations.findMany();

    for (const flag of REQUIRED_FEATURE_FLAGS) {
      const [dbFlag] = await db.select()
        .from(featureFlags)
        .where(eq(featureFlags.featureKey, flag.featureKey));

      if (!dbFlag) continue;

      const isForestGladeOnly = FOREST_GLADE_ENABLED_FEATURES.includes(flag.featureKey as any);
      
      for (const org of allOrgs) {
        const [existing] = await db.select()
          .from(organizationFeatureFlags)
          .where(
            and(
              eq(organizationFeatureFlags.organizationId, org.id),
              eq(organizationFeatureFlags.featureFlagId, dbFlag.id)
            )
          );

        if (isForestGladeOnly) {
          const shouldEnable = forestGlade && org.id === forestGlade.id;
          
          if (shouldEnable) {
            if (existing) {
              await db.update(organizationFeatureFlags)
                .set({
                  isEnabled: true,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(organizationFeatureFlags.organizationId, org.id),
                    eq(organizationFeatureFlags.featureFlagId, dbFlag.id)
                  )
                );
            } else {
              await db.insert(organizationFeatureFlags).values({
                organizationId: org.id,
                featureFlagId: dbFlag.id,
                isEnabled: true,
              });
            }
            log(`  ✓ Enabled ${flag.featureKey} for ${org.name}`);
          } else if (existing) {
            await db.delete(organizationFeatureFlags)
              .where(
                and(
                  eq(organizationFeatureFlags.organizationId, org.id),
                  eq(organizationFeatureFlags.featureFlagId, dbFlag.id)
                )
              );
            log(`  ✓ Removed ${flag.featureKey} override for ${org.name}`);
          }
        } else if (flag.isEnabled && existing) {
          await db.delete(organizationFeatureFlags)
            .where(
              and(
                eq(organizationFeatureFlags.organizationId, org.id),
                eq(organizationFeatureFlags.featureFlagId, dbFlag.id)
              )
            );
          log(`  ✓ Removed stale ${flag.featureKey} override for ${org.name}`);
        }
      }
    }

    log("✅ Feature flags bootstrap complete");
  } catch (error) {
    log(`❌ Feature flags bootstrap failed: ${error}`);
    throw error;
  }
}
