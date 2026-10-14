ALTER TABLE "shipment_events" ADD COLUMN "on_behalf" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "route_events" ADD COLUMN "on_behalf" boolean DEFAULT false NOT NULL;