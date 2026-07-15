ALTER TABLE "incidents" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_incidents_project_id" ON "incidents" USING btree ("project_id");