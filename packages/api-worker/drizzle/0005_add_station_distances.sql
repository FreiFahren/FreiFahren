CREATE TABLE "station_distances" (
	"from_station_id" varchar(16) NOT NULL,
	"to_station_id" varchar(16) NOT NULL,
	"distance" integer NOT NULL,
	CONSTRAINT "station_distances_from_station_id_to_station_id_pk" PRIMARY KEY("from_station_id","to_station_id")
);
--> statement-breakpoint
ALTER TABLE "station_distances" ADD CONSTRAINT "station_distances_from_station_id_stations_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_distances" ADD CONSTRAINT "station_distances_to_station_id_stations_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;