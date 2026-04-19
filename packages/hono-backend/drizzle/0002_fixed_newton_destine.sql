CREATE TABLE "osm_snapshot" (
	"query_kind" varchar(32) PRIMARY KEY NOT NULL,
	"raw" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
