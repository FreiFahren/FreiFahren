CREATE INDEX `reports_station_ts_idx` ON `reports` (`station_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `reports_ts_idx` ON `reports` (`timestamp`);--> statement-breakpoint
CREATE INDEX `reports_line_ts_idx` ON `reports` (`line_id`,`timestamp`);