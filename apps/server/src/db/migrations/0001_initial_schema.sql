CREATE TYPE "public"."audit_action" AS ENUM('created', 'updated', 'deactivated', 'reactivated');--> statement-breakpoint
CREATE TYPE "public"."neighborhood_kind" AS ENUM('neighborhood', 'municipality', 'terminal', 'airport', 'carrier_office');--> statement-breakpoint
CREATE TYPE "public"."package_size" AS ENUM('small', 'medium', 'large', 'extra_large');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('cash_on_delivery', 'recipient_pays_fee', 'merchant_account');--> statement-breakpoint
CREATE TYPE "public"."rate_entry_kind" AS ENUM('zone_rate', 'express_surcharge');--> statement-breakpoint
CREATE TYPE "public"."service_level" AS ENUM('standard', 'express');--> statement-breakpoint
CREATE TYPE "public"."shipment_event_type" AS ENUM('created', 'updated', 'fee_confirmed', 'voided', 'status_changed');--> statement-breakpoint
CREATE TYPE "public"."shipment_kind" AS ENUM('delivery', 'reverse_pickup', 'carrier_handoff', 'errand');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('registered', 'assigned', 'dispatched', 'picked_up', 'delivered', 'exception', 'returned', 'voided');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'dispatcher', 'courier');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"changes" jsonb,
	"client_event_id" uuid,
	CONSTRAINT "audit_events_client_event_id_key" UNIQUE("client_event_id")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'courier' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"failed_sign_in_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carriers_name_normalized_key" UNIQUE("name_normalized")
);
--> statement-breakpoint
CREATE TABLE "courier_aliases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"courier_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"alias_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courier_aliases_alias_normalized_key" UNIQUE("alias_normalized")
);
--> statement-breakpoint
CREATE TABLE "couriers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "couriers_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "merchant_aliases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"alias_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_aliases_alias_normalized_key" UNIQUE("alias_normalized")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"whatsapp_phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_name_normalized_key" UNIQUE("name_normalized")
);
--> statement-breakpoint
CREATE TABLE "pickup_points" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"neighborhood_id" uuid NOT NULL,
	"instructions" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipalities_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "neighborhood_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"neighborhood_id" uuid NOT NULL,
	"variant_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "neighborhood_variants_variant_normalized_key" UNIQUE("variant_normalized")
);
--> statement-breakpoint
CREATE TABLE "neighborhoods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"municipality_id" uuid NOT NULL,
	"rate_zone_id" uuid NOT NULL,
	"kind" "neighborhood_kind" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "neighborhoods_name_municipality_key" UNIQUE("name_normalized","municipality_id")
);
--> statement-breakpoint
CREATE TABLE "rate_card_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "rate_entry_kind" NOT NULL,
	"merchant_id" uuid,
	"rate_zone_id" uuid,
	"amount" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_card_entries_amount_check" CHECK (("rate_card_entries"."kind" = 'zone_rate' and "rate_card_entries"."amount" > 0) or ("rate_card_entries"."kind" = 'express_surcharge' and "rate_card_entries"."amount" >= 0)),
	CONSTRAINT "rate_card_entries_zone_check" CHECK (("rate_card_entries"."kind" = 'zone_rate') = ("rate_card_entries"."rate_zone_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "rate_zones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_zones_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bulk_batches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"row_count" integer NOT NULL,
	"created_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"type" "shipment_event_type" NOT NULL,
	"from_status" "shipment_status",
	"to_status" "shipment_status",
	"actor_user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"changes" jsonb,
	"client_event_id" uuid,
	CONSTRAINT "shipment_events_client_event_id_key" UNIQUE("client_event_id")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tracking_number" char(8) NOT NULL,
	"kind" "shipment_kind" NOT NULL,
	"status" "shipment_status" DEFAULT 'registered' NOT NULL,
	"service_date" date NOT NULL,
	"merchant_id" uuid NOT NULL,
	"pickup_point_id" uuid,
	"pickup_address" text NOT NULL,
	"pickup_neighborhood_id" uuid NOT NULL,
	"recipient_name" text,
	"recipient_name_normalized" text,
	"recipient_phone" text,
	"recipient_address" text,
	"recipient_neighborhood_id" uuid,
	"carrier_id" uuid,
	"destination_town" text,
	"errand_description" text,
	"rate_zone_id" uuid,
	"service_level" "service_level" DEFAULT 'standard' NOT NULL,
	"calculated_fee" integer,
	"fee" integer NOT NULL,
	"fee_override_reason" text,
	"fee_needs_review" boolean DEFAULT false NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"cod_amount" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone,
	"package_size" "package_size",
	"package_count" integer,
	"merchant_reference" text,
	"instructions" text,
	"void_reason" text,
	"bulk_batch_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"registered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_tracking_number_key" UNIQUE("tracking_number"),
	CONSTRAINT "shipments_payment_mode_check" CHECK (("shipments"."payment_mode" = 'cash_on_delivery' and "shipments"."cod_amount" > 0)
        or ("shipments"."payment_mode" = 'recipient_pays_fee' and "shipments"."cod_amount" = "shipments"."fee")
        or ("shipments"."payment_mode" = 'merchant_account' and "shipments"."cod_amount" = 0)),
	CONSTRAINT "shipments_kind_fields_check" CHECK (case "shipments"."kind"
        when 'delivery' then "shipments"."recipient_name" is not null and "shipments"."recipient_phone" is not null
          and "shipments"."recipient_address" is not null and "shipments"."recipient_neighborhood_id" is not null
        when 'reverse_pickup' then "shipments"."recipient_name" is not null and "shipments"."recipient_phone" is not null
          and "shipments"."recipient_address" is not null and "shipments"."recipient_neighborhood_id" is not null
        when 'carrier_handoff' then "shipments"."recipient_neighborhood_id" is not null
          and "shipments"."carrier_id" is not null and "shipments"."destination_town" is not null
        when 'errand' then "shipments"."errand_description" is not null
      end),
	CONSTRAINT "shipments_void_reason_check" CHECK (("shipments"."status" = 'voided') = ("shipments"."void_reason" is not null)),
	CONSTRAINT "shipments_fee_override_check" CHECK (("shipments"."calculated_fee" is not null and "shipments"."fee" = "shipments"."calculated_fee")
        or "shipments"."fee_override_reason" is not null),
	CONSTRAINT "shipments_reason_length_check" CHECK (("shipments"."fee_override_reason" is null or char_length("shipments"."fee_override_reason") between 5 and 200)
        and ("shipments"."void_reason" is null or char_length("shipments"."void_reason") between 5 and 200)),
	CONSTRAINT "shipments_fee_check" CHECK ("shipments"."fee" > 0),
	CONSTRAINT "shipments_cod_amount_check" CHECK ("shipments"."cod_amount" >= 0),
	CONSTRAINT "shipments_window_check" CHECK ("shipments"."window_start" is null or "shipments"."window_end" is null or "shipments"."window_start" < "shipments"."window_end"),
	CONSTRAINT "shipments_package_count_check" CHECK ("shipments"."package_count" is null or "shipments"."package_count" >= 1)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_aliases" ADD CONSTRAINT "courier_aliases_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couriers" ADD CONSTRAINT "couriers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_aliases" ADD CONSTRAINT "merchant_aliases_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_points" ADD CONSTRAINT "pickup_points_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_points" ADD CONSTRAINT "pickup_points_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhood_variants" ADD CONSTRAINT "neighborhood_variants_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_rate_zone_id_rate_zones_id_fk" FOREIGN KEY ("rate_zone_id") REFERENCES "public"."rate_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_card_entries" ADD CONSTRAINT "rate_card_entries_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_card_entries" ADD CONSTRAINT "rate_card_entries_rate_zone_id_rate_zones_id_fk" FOREIGN KEY ("rate_zone_id") REFERENCES "public"."rate_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_card_entries" ADD CONSTRAINT "rate_card_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_batches" ADD CONSTRAINT "bulk_batches_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_batches" ADD CONSTRAINT "bulk_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_pickup_point_id_pickup_points_id_fk" FOREIGN KEY ("pickup_point_id") REFERENCES "public"."pickup_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_pickup_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("pickup_neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_recipient_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("recipient_neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_rate_zone_id_rate_zones_id_fk" FOREIGN KEY ("rate_zone_id") REFERENCES "public"."rate_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_bulk_batch_id_bulk_batches_id_fk" FOREIGN KEY ("bulk_batch_id") REFERENCES "public"."bulk_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_points_one_default_per_merchant" ON "pickup_points" USING btree ("merchant_id") WHERE "pickup_points"."is_default";--> statement-breakpoint
CREATE INDEX "pickup_points_merchant_idx" ON "pickup_points" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "neighborhood_variants_trgm_idx" ON "neighborhood_variants" USING gin ("variant_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "neighborhoods_name_trgm_idx" ON "neighborhoods" USING gin ("name_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "rate_card_entries_lookup_idx" ON "rate_card_entries" USING btree ("kind","merchant_id","rate_zone_id","effective_from");--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_idx" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "shipments_board_idx" ON "shipments" USING btree ("service_date","status");--> statement-breakpoint
CREATE INDEX "shipments_pending_idx" ON "shipments" USING btree ("service_date") WHERE "shipments"."status" not in ('delivered', 'returned', 'voided');--> statement-breakpoint
CREATE INDEX "shipments_recipient_name_trgm_idx" ON "shipments" USING gin ("recipient_name_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "shipments_recipient_phone_idx" ON "shipments" USING btree ("recipient_phone");--> statement-breakpoint
CREATE INDEX "shipments_merchant_reference_idx" ON "shipments" USING btree ("merchant_id","merchant_reference","service_date");