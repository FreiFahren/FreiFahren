CREATE TABLE `report_moderation` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_moderation_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enabled` integer NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_quarantines` (
	`report_id` integer PRIMARY KEY NOT NULL,
	`original_trust` real,
	`quarantined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`report_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- The gate writes through private RPC and may score asynchronously. Enforce the
-- override where both writers meet, and keep its score for incident analysis.
CREATE TRIGGER quarantine_incoming_reports AFTER INSERT ON reports
WHEN NEW.source <> 'telegram' AND EXISTS (SELECT 1 FROM report_moderation WHERE id = 1 AND enabled = 1)
BEGIN
    INSERT OR IGNORE INTO report_quarantines (report_id, original_trust, quarantined_at)
    VALUES (NEW.report_id, NEW.trust, unixepoch() * 1000);
    UPDATE reports SET trust = 0 WHERE report_id = NEW.report_id;
END;
--> statement-breakpoint
CREATE TRIGGER preserve_report_quarantine AFTER UPDATE OF trust ON reports
WHEN NEW.trust IS NOT 0 AND EXISTS (SELECT 1 FROM report_quarantines WHERE report_id = NEW.report_id)
BEGIN
    UPDATE report_quarantines SET original_trust = NEW.trust WHERE report_id = NEW.report_id;
    UPDATE reports SET trust = 0 WHERE report_id = NEW.report_id;
END;
