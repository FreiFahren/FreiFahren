CREATE TYPE "public"."source" AS ENUM('mini_app', 'web_app', 'mobile_app', 'telegram');--> statement-breakpoint
CREATE TABLE "line_stations" (
	"line_id" varchar(16) NOT NULL,
	"station_id" varchar(16) NOT NULL,
	"order" integer NOT NULL,
	CONSTRAINT "line_stations_line_id_station_id_pk" PRIMARY KEY("line_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "lines" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_circular" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"report_id" serial PRIMARY KEY NOT NULL,
	"station_id" varchar(16) NOT NULL,
	"line_id" varchar(16),
	"direction_id" varchar(16),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"source" "source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_stations" ADD CONSTRAINT "line_stations_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_stations" ADD CONSTRAINT "line_stations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_direction_id_lines_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;