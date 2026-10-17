import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// 1. Cached Topics (Read-only on client)
// Fetched and stored when the user is online so they can browse topics offline in the metro.
export const localTopics = sqliteTable(
  "local_topics",
  {
    id: text("id").primaryKey(), // Stringified UUID matching Postgres
    localTopicId: integer("local_topic_id").notNull().unique(), // The 2-byte int used in BLE broadcast
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    category: text("category").notNull(),
  }
);

// 2. Offline Encounters Queue
export const localEncounters = sqliteTable(
  "local_encounters",
  {
    // Generate a UUID locally using `expo-crypto` when the handshake succeeds
    id: text("id").primaryKey(),

    peerBeaconHash: text("peer_beacon_hash").notNull(),
    topicId: text("topic_id").notNull(),

    // 'pending', 'active', 'meet_requested', 'meet_accepted', 'completed'
    status: text("status").notNull().default("active"),

    p2pSessionKeyHash: text("p2p_session_key_hash"), // Stored to resume dropped BLE connections
    revealColor: text("reveal_color"),

    // Unix timestamps (integer) are faster for SQLite sorting and querying
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),

    // THE SYNC ENGINE FLAG
    // 0 = PENDING, 1 = SYNCED, 2 = FAILED_RETRY
    syncStatus: integer("sync_status").notNull().default(0),
  },
  (table) => ({
    syncIdx: index("encounters_sync_idx").on(table.syncStatus),
    beaconIdx: index("encounters_beacon_idx").on(table.peerBeaconHash),
  })
);

// 3. Offline Messages Queue
export const localMessages = sqliteTable(
  "local_messages",
  {
    id: text("id").primaryKey(), // Local UUID
    encounterId: text("encounter_id")
      .notNull()
      .references(() => localEncounters.id, { onDelete: "cascade" }),

    // Instead of full user IDs (which you don't have offline), just track direction
    isFromMe: integer("is_from_me", { mode: "boolean" }).notNull(),

    encryptedPayload: text("encrypted_payload").notNull(),
    clientSequenceNumber: integer("client_sequence_number").notNull(),

    sentAt: integer("sent_at").notNull(),

    // 0 = PENDING, 1 = SYNCED
    syncStatus: integer("sync_status").notNull().default(0),
  },
  (table) => ({
    encounterSyncIdx: index("messages_encounter_sync_idx").on(
      table.encounterId,
      table.syncStatus
    ),
  })
);
