ALTER TABLE "house_league_teams" ADD COLUMN "calendar_subscription_token" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "calendar_subscription_token" text;--> statement-breakpoint
ALTER TABLE "house_league_teams" ADD CONSTRAINT "house_league_teams_calendar_subscription_token_unique" UNIQUE("calendar_subscription_token");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_calendar_subscription_token_unique" UNIQUE("calendar_subscription_token");