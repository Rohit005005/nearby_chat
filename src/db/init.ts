import { openDatabaseSync } from "expo-sqlite";

export function initializeDatabase() {
  const db = openDatabaseSync("metro_local.db");

  // Create tables and seed the Game Theory topic
  db.execSync(`
    CREATE TABLE IF NOT EXISTS local_topics (
      id TEXT PRIMARY KEY,
      local_topic_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_encounters (
      id TEXT PRIMARY KEY,
      peer_beacon_hash TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      p2p_session_key_hash TEXT,
      reveal_color TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      sync_status INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS local_messages (
      id TEXT PRIMARY KEY,
      encounter_id TEXT NOT NULL,
      is_from_me INTEGER NOT NULL,
      encrypted_payload TEXT NOT NULL,
      client_sequence_number INTEGER NOT NULL,
      sent_at INTEGER NOT NULL,
      sync_status INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (encounter_id) REFERENCES local_encounters(id) ON DELETE CASCADE
    );

    INSERT OR IGNORE INTO local_topics (id, local_topic_id, title, prompt, category)
    VALUES ('topic-uuid-1', 104, 'Game Theory & Bystander Effect', 'Let us discuss human behavior', 'Intellectual');
  `);

  console.log("Database tables initialized and seeded.");
}
