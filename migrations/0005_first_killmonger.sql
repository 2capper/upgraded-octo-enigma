CREATE TABLE "inbound_sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"message_body" text NOT NULL,
	"matched_team_id" text,
	"matched_tournament_id" text,
	"matched_role" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diamonds" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "diamonds" ADD COLUMN "status_message" text;--> statement-breakpoint
ALTER TABLE "organization_twilio_settings" ADD COLUMN "auto_reply_message" text DEFAULT 'This is an automated alert system. Please contact your Tournament Director directly.';--> statement-breakpoint
ALTER TABLE "inbound_sms_messages" ADD CONSTRAINT "inbound_sms_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_sms_messages" ADD CONSTRAINT "inbound_sms_messages_matched_team_id_teams_id_fk" FOREIGN KEY ("matched_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_sms_messages" ADD CONSTRAINT "inbound_sms_messages_matched_tournament_id_tournaments_id_fk" FOREIGN KEY ("matched_tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;