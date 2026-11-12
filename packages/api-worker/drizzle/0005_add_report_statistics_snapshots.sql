CREATE TABLE `report_statistics` (
	`period` text PRIMARY KEY NOT NULL,
	`computed_at` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_statistics_refreshes` (
	`period` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL
);
