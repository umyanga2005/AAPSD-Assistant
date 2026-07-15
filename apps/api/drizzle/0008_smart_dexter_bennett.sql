CREATE TABLE "action_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"typed_args" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"actor_id" uuid NOT NULL,
	"approver_id" uuid,
	"policy_result" jsonb,
	"trace_id" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"request_id" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"trace_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ap_project_id" ON "action_plans" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ap_environment_id" ON "action_plans" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "idx_ap_status" ON "action_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_diag_project_id" ON "diagnoses" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_diag_request_id" ON "diagnoses" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_diag_trace_id" ON "diagnoses" USING btree ("trace_id");