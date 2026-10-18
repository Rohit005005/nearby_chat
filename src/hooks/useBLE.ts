import { useState, useRef } from "react";
import { BleManager } from "react-native-ble-plx";
import { PermissionsAndroid, Platform } from "react-native";
import { eq } from "drizzle-orm";

import { localTopics } from "../db/schema";

import { localDb } from "../db/client";
import { DiscoveredPeerPayload, parseManufacturerData } from "../lib/blePayloadParser";

export const bleManager = new BleManager();
export const METRO_CHAT_SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";

export interface DiscoveredPeer {
  deviceId: string;
  rssi: number | null;
  beaconHash: string;
  topicTitle: string;
  topicCategory: string;
  statusFlag: number;
}

export default function useBLE() {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);

  // Cache seen beacons in memory to avoid redundant SQLite queries and UI flickers
  const seenPeers = useRef<Set<string>>(new Set());

  const requestAndroidPermissions = async () => {
    if (Platform.OS !== "android") return true;

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return (
        granted["android.permission.BLUETOOTH_CONNECT"] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        granted["android.permission.BLUETOOTH_SCAN"] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn("Permission error:", err);
      return false;
    }
  };

  const startScanning = async (myBeaconHash?: string) => {
    const hasPermissions = await requestAndroidPermissions();
    if (!hasPermissions) {
      console.warn("Bluetooth permissions missing.");
      return;
    }

    seenPeers.current.clear();
    setDiscoveredPeers([]);
    setIsScanning(true);

    // Pass the Service UUID array to let the OS hardware filter out non-Metro devices
    bleManager.startDeviceScan(
      [METRO_CHAT_SERVICE_UUID],
      { allowDuplicates: false },
      async (error, device) => {
        if (error) {
          console.error("Scanning error:", error);
          setIsScanning(false);
          return;
        }

        if (!device || !device.manufacturerData) return;

        // 1. Unpack custom payload
        const payload: DiscoveredPeerPayload | null = parseManufacturerData(
          device.manufacturerData,
        );
        if (!payload) return;

        // Ignore your own broadcast if your phone picks it up
        if (myBeaconHash && payload.beaconHash === myBeaconHash) return;

        // Ignore if currently chatting (0x02) or already processed in this scan session
        if (
          payload.statusFlag !== 1 ||
          seenPeers.current.has(payload.beaconHash)
        ) {
          return;
        }

        // Mark as seen
        seenPeers.current.add(payload.beaconHash);

        // 2. Look up topic in local SQLite
        try {
          const [matchedTopic] = await localDb
            .select()
            .from(localTopics)
            .where(eq(localTopics.localTopicId, payload.topicId))
            .limit(1);

          if (!matchedTopic) {
            console.log(
              `Discovered topic ID ${payload.topicId} not found in local cache.`,
            );
            return;
          }

          const peerInfo: DiscoveredPeer = {
            deviceId: device.id, // MAC on Android, CoreBluetooth UUID on iOS
            rssi: device.rssi,
            beaconHash: payload.beaconHash,
            topicTitle: matchedTopic.title,
            topicCategory: matchedTopic.category,
            statusFlag: payload.statusFlag,
          };

          // 3. Update active state for the UI
          setDiscoveredPeers((prev) => [...prev, peerInfo]);
        } catch (dbError) {
          console.error("Local SQLite query error during BLE scan:", dbError);
        }
      },
    );
  };

  const stopScanning = () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
  };

  return {
    startScanning,
    stopScanning,
    isScanning,
    discoveredPeers,
  };
}
