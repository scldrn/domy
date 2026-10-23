ALTER TYPE "public"."audit_action" ADD VALUE 'link_replaced';--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'notified';--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "link_code" text DEFAULT translate(rtrim(encode(substring(sha256(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid())) from 1 for 16), 'base64'), '='), '+/', '-_') NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "link_replaced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "tracking_code" text DEFAULT translate(rtrim(encode(substring(sha256(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid())) from 1 for 16), 'base64'), '='), '+/', '-_') NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "notified_by" uuid;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "support_phone" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "company_name" text DEFAULT 'Cohex' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_notified_by_users_id_fk" FOREIGN KEY ("notified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_link_code_key" UNIQUE("link_code");--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tracking_code_key" UNIQUE("tracking_code");--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_link_code_format_check" CHECK ("merchants"."link_code" ~ '^[A-Za-z0-9_-]{22}$');--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tracking_code_format_check" CHECK ("shipments"."tracking_code" ~ '^[A-Za-z0-9_-]{22}$');--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_notification_actor_time_check" CHECK (("shipments"."notified_at" is null) = ("shipments"."notified_by" is null));--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_support_phone_check" CHECK ("company_settings"."support_phone" is null or "company_settings"."support_phone" ~ '^[0-9]{10}$');--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_name_check" CHECK (char_length(btrim("company_settings"."company_name")) > 0);