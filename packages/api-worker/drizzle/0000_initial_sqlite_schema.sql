CREATE TABLE `line_stations` (
	`line_id` text(16) NOT NULL,
	`station_id` text(16) NOT NULL,
	`order` integer NOT NULL,
	PRIMARY KEY(`line_id`, `station_id`),
	FOREIGN KEY (`line_id`) REFERENCES `lines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`station_id`) REFERENCES `stations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lines` (
	`id` text(16) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`type` text(32) NOT NULL,
	`is_circular` integer DEFAULT false NOT NULL,
	`color` text(7) DEFAULT '#000000' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`report_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`station_id` text(16) NOT NULL,
	`line_id` text(16),
	`direction_id` text(16),
	`timestamp` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`station_id`) REFERENCES `stations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`line_id`) REFERENCES `lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`direction_id`) REFERENCES `stations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `segments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`line_id` text(16) NOT NULL,
	`from_station_id` text(16) NOT NULL,
	`to_station_id` text(16) NOT NULL,
	`position` integer NOT NULL,
	`color` text(7) NOT NULL,
	`coordinates` text NOT NULL,
	FOREIGN KEY (`line_id`) REFERENCES `lines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_station_id`) REFERENCES `stations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_station_id`) REFERENCES `stations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `segments_line_from_to_idx` ON `segments` (`line_id`,`from_station_id`,`to_station_id`);--> statement-breakpoint
CREATE TABLE `stations` (
	`id` text(16) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL
);
