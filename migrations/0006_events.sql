-- Mirrors the tail of src/services/operationsMigration.ts. Keep both in sync. Event settings columns are added by the Worker.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  price_note TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','internal')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','cancelled')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none','weekly','monthly')),
  recurrence_until TEXT NOT NULL DEFAULT '',
  skipped_dates TEXT NOT NULL DEFAULT '[]',
  booking_enabled INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 0,
  max_party INTEGER NOT NULL DEFAULT 6,
  cutoff_hours REAL NOT NULL DEFAULT 0,
  telegram_chat_id TEXT NOT NULL DEFAULT '',
  telegram_message_id INTEGER,
  telegram_has_photo INTEGER NOT NULL DEFAULT 0,
  telegram_posted_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS event_bookings (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  occurrence_date TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  customer_id TEXT,
  seats INTEGER NOT NULL CHECK(seats > 0),
  note TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','checked_in')),
  paid INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_event_bookings_occurrence ON event_bookings(event_id, occurrence_date);
