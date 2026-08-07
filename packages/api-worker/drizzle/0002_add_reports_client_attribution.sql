ALTER TABLE `reports` ADD `asn` integer;--> statement-breakpoint
ALTER TABLE `reports` ADD `as_organization` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `ua_family` text(32);--> statement-breakpoint
ALTER TABLE `reports` ADD `client_hash` text(32);--> statement-breakpoint
CREATE INDEX `reports_client_ts_idx` ON `reports` (`client_hash`,`timestamp`);
