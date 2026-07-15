CREATE TABLE "system_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"component" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_system_connections_provider" ON "system_connections" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_system_connections_created_at" ON "system_connections" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_system_logs_level" ON "system_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_system_logs_created_at" ON "system_logs" USING btree ("created_at");