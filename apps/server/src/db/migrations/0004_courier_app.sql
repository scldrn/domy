CREATE TYPE "public"."courier_record_kind" AS ENUM('pickup', 'delivery', 'exception', 'problem', 'return', 'disbursement', 'handover_confirmation');--> statement-breakpoint
CREATE TYPE "public"."exception_reason" AS ENUM('recipient_absent', 'wrong_address', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."not_applied_reason" AS ENUM('voided', 'delivered', 'returned', 'already_picked_up', 'not_picked_up', 'not_in_custody', 'no_task', 'no_handover');--> statement-breakpoint
CREATE TYPE "public"."notice_type" AS ENUM('route_dispatched', 'shipment_added', 'shipment_removed', 'shipment_voided', 'shipment_updated', 'stops_reordered', 'shipment_reassigned_in', 'shipment_reassigned_out', 'route_reassigned', 'dispatch_undone', 'handover_requested', 'handover_cancelled', 'exception_decided', 'office_received', 'record_corrected', 'record_reverted', 'record_not_applied');--> statement-breakpoint
CREATE TYPE "public"."photo_kind" AS ENUM('proof', 'transfer_receipt', 'disbursement_receipt', 'exception');--> statement-breakpoint
CREATE TYPE "public"."record_outcome" AS ENUM('applied', 'duplicate', 'not_applied');--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'exception_decided';--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'office_received';--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'record_corrected';--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'record_reverted';--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'review_cleared';--> statement-breakpoint
ALTER TYPE "public"."stop_kind" ADD VALUE 'return';--> statement-breakpoint
CREATE TABLE "courier_notices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"courier_id" uuid NOT NULL,
	"type" "notice_type" NOT NULL,
	"route_id" uuid,
	"shipment_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "courier_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shipment_id" uuid NOT NULL,
	"kind" "courier_record_kind" NOT NULL,
	"courier_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"on_behalf" boolean DEFAULT false NOT NULL,
	"route_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"location_accuracy_m" integer,
	"outcome" "record_outcome" NOT NULL,
	"not_applied_reason" "not_applied_reason",
	"received_by_name" text,
	"cash_amount" integer DEFAULT 0 NOT NULL,
	"company_transfer_amount" integer DEFAULT 0 NOT NULL,
	"merchant_transfer_amount" integer DEFAULT 0 NOT NULL,
	"exception_reason" "exception_reason",
	"note" text,
	"disbursement_amount" integer,
	"payee" text,
	"reverted_at" timestamp with time zone,
	"reverted_by" uuid,
	"revert_reason" text,
	CONSTRAINT "courier_records_time_check" CHECK ("courier_records"."occurred_at" <= "courier_records"."recorded_at"),
	CONSTRAINT "courier_records_outcome_check" CHECK (("courier_records"."outcome" = 'not_applied') = ("courier_records"."not_applied_reason" is not null)),
	CONSTRAINT "courier_records_location_check" CHECK (("courier_records"."latitude" is null) = ("courier_records"."longitude" is null)
        and ("courier_records"."latitude" is null) = ("courier_records"."location_accuracy_m" is null)
        and ("courier_records"."location_accuracy_m" is null or "courier_records"."location_accuracy_m" >= 0)),
	CONSTRAINT "courier_records_received_by_check" CHECK (("courier_records"."kind" <> 'return' or "courier_records"."received_by_name" is not null)
        and ("courier_records"."kind" in ('delivery', 'return') or "courier_records"."received_by_name" is null)
        and ("courier_records"."received_by_name" is null or char_length("courier_records"."received_by_name") between 2 and 100)),
	CONSTRAINT "courier_records_amounts_check" CHECK ("courier_records"."cash_amount" >= 0 and "courier_records"."company_transfer_amount" >= 0
        and "courier_records"."merchant_transfer_amount" >= 0
        and ("courier_records"."kind" = 'delivery'
          or "courier_records"."cash_amount" + "courier_records"."company_transfer_amount" + "courier_records"."merchant_transfer_amount" = 0)),
	CONSTRAINT "courier_records_exception_reason_check" CHECK (("courier_records"."kind" = 'exception') = ("courier_records"."exception_reason" is not null)),
	CONSTRAINT "courier_records_note_check" CHECK (("courier_records"."note" is null or char_length("courier_records"."note") between 5 and 200)
        and ("courier_records"."kind" <> 'problem' or "courier_records"."note" is not null)),
	CONSTRAINT "courier_records_disbursement_check" CHECK (("courier_records"."kind" = 'disbursement') = ("courier_records"."disbursement_amount" is not null)
        and ("courier_records"."kind" = 'disbursement') = ("courier_records"."payee" is not null)
        and ("courier_records"."disbursement_amount" is null or "courier_records"."disbursement_amount" > 0)
        and ("courier_records"."payee" is null or char_length("courier_records"."payee") between 2 and 100)),
	CONSTRAINT "courier_records_revert_check" CHECK (("courier_records"."reverted_at" is null) = ("courier_records"."reverted_by" is null)
        and ("courier_records"."reverted_at" is null) = ("courier_records"."revert_reason" is null)
        and ("courier_records"."revert_reason" is null or char_length("courier_records"."revert_reason") between 5 and 200))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "record_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"kind" "photo_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_at" timestamp with time zone,
	"byte_size" integer,
	CONSTRAINT "record_photos_upload_check" CHECK (("record_photos"."uploaded_at" is null) = ("record_photos"."byte_size" is null)
        and ("record_photos"."byte_size" is null or "record_photos"."byte_size" between 1 and 1048576))
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT '00000000-0000-7000-8000-000000000001' NOT NULL,
	"office_address" text,
	"office_neighborhood_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_settings_single_row_check" CHECK ("company_settings"."id" = '00000000-0000-7000-8000-000000000001'),
	CONSTRAINT "company_settings_office_check" CHECK (("company_settings"."office_address" is null) = ("company_settings"."office_neighborhood_id" is null)
        and ("company_settings"."office_address" is null or char_length("company_settings"."office_address") between 5 and 200))
);
--> statement-breakpoint
ALTER TABLE "couriers" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "held_at_office" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "return_decided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "route_tasks" ADD COLUMN "problem_note" text;--> statement-breakpoint
ALTER TABLE "courier_notices" ADD CONSTRAINT "courier_notices_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_notices" ADD CONSTRAINT "courier_notices_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_notices" ADD CONSTRAINT "courier_notices_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_records" ADD CONSTRAINT "courier_records_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_records" ADD CONSTRAINT "courier_records_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_records" ADD CONSTRAINT "courier_records_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_records" ADD CONSTRAINT "courier_records_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_records" ADD CONSTRAINT "courier_records_reverted_by_users_id_fk" FOREIGN KEY ("reverted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_photos" ADD CONSTRAINT "record_photos_record_id_courier_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."courier_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_office_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("office_neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courier_notices_unacknowledged_idx" ON "courier_notices" USING btree ("courier_id") WHERE "courier_notices"."acknowledged_at" is null;--> statement-breakpoint
CREATE INDEX "courier_records_shipment_idx" ON "courier_records" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "courier_records_courier_idx" ON "courier_records" USING btree ("courier_id","occurred_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "record_photos_record_idx" ON "record_photos" USING btree ("record_id");--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_custody_check" CHECK (not ("shipments"."held_at_office" and "shipments"."custody_courier_id" is not null));--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_return_decided_check" CHECK (not "shipments"."return_decided" or "shipments"."status" in ('exception', 'returned'));--> statement-breakpoint
ALTER TABLE "route_tasks" ADD CONSTRAINT "route_tasks_problem_note_check" CHECK ("route_tasks"."problem_note" is null or char_length("route_tasks"."problem_note") between 5 and 200);