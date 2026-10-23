CREATE TABLE "account_action_receipts" (
	"client_intent_id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"target_user_id" uuid NOT NULL,
	"input" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"status" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_action_receipts_operation_check" CHECK ("account_action_receipts"."operation" in ('create', 'profile', 'role', 'deactivate', 'reactivate', 'end_sessions')),
	CONSTRAINT "account_action_receipts_status_check" CHECK ("account_action_receipts"."status" >= 200 and "account_action_receipts"."status" < 300)
);
--> statement-breakpoint
ALTER TABLE "account_action_receipts" ADD CONSTRAINT "account_action_receipts_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_action_receipts" ADD CONSTRAINT "account_action_receipts_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;