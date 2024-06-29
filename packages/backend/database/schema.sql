CREATE TABLE IF NOT EXISTS ticket_info (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  message TEXT,
  line VARCHAR(3),
  station_name VARCHAR(255),
  station_id VARCHAR(10),
  direction_name VARCHAR(255),
  direction_id VARCHAR(10)
);
