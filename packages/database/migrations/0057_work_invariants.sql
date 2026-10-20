ALTER TABLE "work_executions" DROP CONSTRAINT "work_executions_work_item_id_work_items_id_fk";
--> statement-breakpoint
ALTER TABLE "work_executions" ADD COLUMN "work_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_executions" ADD CONSTRAINT "work_executions_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_items_one_active_goal_per_user" ON "work_items" USING btree ("user_id") WHERE "work_items"."kind" = 'goal' and "work_items"."status" = 'active';--> statement-breakpoint
ALTER TABLE "work_executions" ADD CONSTRAINT "work_executions_risk_check" CHECK ("work_executions"."risk" in ('read', 'write', 'external'));--> statement-breakpoint
ALTER TABLE "work_executions" ADD CONSTRAINT "work_executions_status_check" CHECK ("work_executions"."status" in ('proposed', 'approved', 'running', 'needs_input', 'done', 'failed', 'refused'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_kind_check" CHECK ("work_items"."kind" in ('goal', 'plan', 'step'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_status_check" CHECK ("work_items"."status" in ('open', 'active', 'blocked', 'done', 'dropped'));