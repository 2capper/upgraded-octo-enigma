ALTER TABLE "organizations" ADD COLUMN "is_claimed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "claim_token" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "scheduling_requests" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "willing_to_play_extra" boolean DEFAULT false NOT NULL;