CREATE TYPE "public"."handover_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."route_event_type" AS ENUM('created', 'shipment_added', 'shipment_removed', 'reordered', 'courier_set', 'dispatched', 'dispatch_undone', 'reassigned', 'handover_requested', 'handover_confirmed', 'handover_cancelled', 'cancelled', 'finished');--> statement-breakpoint
CREATE TYPE "public"."route_status" AS ENUM('draft', 'in_progress', 'finished', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stop_kind" AS ENUM('pickup', 'delivery', 'errand');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'reassigned';--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'handover_confirmed';--> statement-breakpoint
ALTER TYPE "public"."shipment_event_type" ADD VALUE 'handover_cancelled';--> statement-breakpoint
CREATE TABLE "handovers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"from_courier_id" uuid NOT NULL,
	"to_courier_id" uuid NOT NULL,
	"from_route_id" uuid,
	"to_route_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "handover_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolved_on_behalf" boolean DEFAULT false NOT NULL,
	CONSTRAINT "handovers_couriers_check" CHECK ("handovers"."from_courier_id" <> "handovers"."to_courier_id"),
	CONSTRAINT "handovers_reason_check" CHECK (char_length("handovers"."reason") between 5 and 200)
);
--> statement-breakpoint
CREATE TABLE "route_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"route_id" uuid NOT NULL,
	"type" "route_event_type" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shipment_id" uuid,
	"from_courier_id" uuid,
	"to_courier_id" uuid,
	"reason" text,
	"changes" jsonb,
	"client_event_id" uuid,
	CONSTRAINT "route_events_client_event_id_key" UNIQUE("client_event_id")
);
--> statement-breakpoint
CREATE TABLE "route_stops" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "stop_kind" NOT NULL,
	"address" text NOT NULL,
	"neighborhood_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_stops_route_position_key" UNIQUE("route_id","position")
);
--> statement-breakpoint
CREATE TABLE "route_tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"stop_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"kind" "stop_kind" NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_courier_id" uuid,
	"blocked_by_handover_id" uuid,
	CONSTRAINT "route_tasks_blocked_check" CHECK ("route_tasks"."blocked_by_handover_id" is null or "route_tasks"."status" = 'pending')
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"service_date" date NOT NULL,
	"number" integer NOT NULL,
	"courier_id" uuid,
	"status" "route_status" DEFAULT 'draft' NOT NULL,
	"cancel_reason" text,
	"dispatched_at" timestamp with time zone,
	"dispatched_by" uuid,
	"finished_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_service_date_number_key" UNIQUE("service_date","number"),
	CONSTRAINT "routes_courier_check" CHECK ("routes"."status" not in ('in_progress', 'finished') or "routes"."courier_id" is not null),
	CONSTRAINT "routes_cancel_reason_check" CHECK (("routes"."status" = 'cancelled') = ("routes"."cancel_reason" is not null)
        and ("routes"."cancel_reason" is null or char_length("routes"."cancel_reason") between 5 and 200))
);
--> statement-breakpoint
ALTER TABLE "shipment_events" ADD COLUMN "route_id" uuid;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "route_id" uuid;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "custody_courier_id" uuid;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_from_courier_id_couriers_id_fk" FOREIGN KEY ("from_courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_to_courier_id_couriers_id_fk" FOREIGN KEY ("to_courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_from_route_id_routes_id_fk" FOREIGN KEY ("from_route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_to_route_id_routes_id_fk" FOREIGN KEY ("to_route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_events" ADD CONSTRAINT "route_events_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_events" ADD CONSTRAINT "route_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_events" ADD CONSTRAINT "route_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_events" ADD CONSTRAINT "route_events_from_courier_id_couriers_id_fk" FOREIGN KEY ("from_courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_events" ADD CONSTRAINT "route_events_to_courier_id_couriers_id_fk" FOREIGN KEY ("to_courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_tasks" ADD CONSTRAINT "route_tasks_stop_id_route_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."route_stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_tasks" ADD CONSTRAINT "route_tasks_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_tasks" ADD CONSTRAINT "route_tasks_completed_by_courier_id_couriers_id_fk" FOREIGN KEY ("completed_by_courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_tasks" ADD CONSTRAINT "route_tasks_blocked_by_handover_id_handovers_id_fk" FOREIGN KEY ("blocked_by_handover_id") REFERENCES "public"."handovers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_dispatched_by_users_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "handovers_one_pending_per_shipment" ON "handovers" USING btree ("shipment_id") WHERE "handovers"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "route_events_route_idx" ON "route_events" USING btree ("route_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "route_tasks_one_pending_per_shipment_kind" ON "route_tasks" USING btree ("shipment_id","kind") WHERE "route_tasks"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "route_tasks_stop_idx" ON "route_tasks" USING btree ("stop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "routes_one_in_progress_per_courier" ON "routes" USING btree ("courier_id") WHERE "routes"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "routes_service_date_idx" ON "routes" USING btree ("service_date","status");--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_custody_courier_id_couriers_id_fk" FOREIGN KEY ("custody_courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipments_route_idx" ON "shipments" USING btree ("route_id");--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_route_check" CHECK (("shipments"."status" <> 'registered' or "shipments"."route_id" is null)
        and ("shipments"."status" not in ('assigned', 'dispatched') or "shipments"."route_id" is not null));