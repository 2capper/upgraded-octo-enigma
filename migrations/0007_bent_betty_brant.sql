ALTER TABLE "notification_log" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_log" ADD COLUMN "scope" text DEFAULT 'organization' NOT NULL;