ALTER TABLE "lines" ADD COLUMN "type" varchar(32) NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "lines" ALTER COLUMN "type" DROP DEFAULT;
