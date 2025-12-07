CREATE TABLE "feedback" (
	"feedback_id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"feedback" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_stations" ADD CONSTRAINT "line_stations_line_id_station_id_pk" PRIMARY KEY("line_id","station_id");--> statement-breakpoint
ALTER TABLE "lines" ADD COLUMN "is_circular" boolean DEFAULT false NOT NULL;