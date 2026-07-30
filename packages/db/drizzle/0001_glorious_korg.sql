CREATE TYPE "public"."alert_kind" AS ENUM('price_above', 'price_below', 'news', 'earnings');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'triggered', 'dismissed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"kind" "alert_kind" NOT NULL,
	"threshold" numeric(14, 4),
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"triggered_at" timestamp with time zone,
	"triggered_message" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "shares" numeric(18, 6);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_user_id_idx" ON "alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_status_idx" ON "alerts" USING btree ("status");