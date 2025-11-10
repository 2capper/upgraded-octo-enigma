ALTER TABLE "teams" DROP CONSTRAINT "teams_pool_id_pools_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "pool_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "diamonds" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "diamonds" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "has_diamond_booking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE set null ON UPDATE no action;