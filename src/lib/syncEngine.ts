import * as Network from "expo-network";
import { eq } from "drizzle-orm";
import { localDb } from "../db/client";
import { localEncounters, localMessages } from "../db/schema";

// Replace with your actual deployed Next.js URL or local IP for testing
const API_URL = "https://your-nextjs-api.com/api/sync";

export async function runOfflineSync() {
  try {
    // 1. Check if we have internet
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      console.log("Sync skipped: No internet connection.");
      return false;
    }

    // 2. Fetch all pending records from local SQLite
    const pendingEncounters = await localDb
      .select()
      .from(localEncounters)
      .where(eq(localEncounters.syncStatus, 0));

    const pendingMessages = await localDb
      .select()
      .from(localMessages)
      .where(eq(localMessages.syncStatus, 0));

    if (pendingEncounters.length === 0 && pendingMessages.length === 0) {
      console.log("Sync skipped: No pending data.");
      return true;
    }

    // 3. Push to Next.js Backend
    console.log(
      `Syncing ${pendingEncounters.length} encounters and ${pendingMessages.length} messages...`,
    );

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encounters: pendingEncounters,
        messages: pendingMessages,
        // In a real app, include the user's auth token here
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    // 4. Mark local rows as Synced (1)
    if (pendingEncounters.length > 0) {
      await localDb
        .update(localEncounters)
        .set({ syncStatus: 1 })
        .where(eq(localEncounters.syncStatus, 0));
    }

    if (pendingMessages.length > 0) {
      await localDb
        .update(localMessages)
        .set({ syncStatus: 1 })
        .where(eq(localMessages.syncStatus, 0));
    }

    console.log("Offline sync complete!");
    return true;
  } catch (error) {
    console.error("Background sync failed:", error);
    return false;
  }
}
