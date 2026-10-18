import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import * as Crypto from "expo-crypto";
import { Buffer } from "buffer";
import { x25519 } from "@noble/curves/ed25519.js";

// Hooks & DB
import useBLE, { DiscoveredPeer, bleManager } from "../hooks/useBLE";
import useBLEServer from "../hooks/useBLEServer";
import { performHandshake } from "../hooks/useBLEHandshake";
import { localDb } from "../db/client";
import { localEncounters } from "../db/schema";

export default function MetroScreen({ navigation }: any) {
  const { startScanning, stopScanning, isScanning, discoveredPeers } = useBLE();
  const { startBroadcasting, stopBroadcasting, isBroadcasting, peerPublicKey } =
    useBLEServer();

  // Store the Broadcaster's private key so we can compute the shared secret
  // when a scanner (Device B) connects and sends their public key.
  const myServerPrivateKey = useRef<Uint8Array | null>(null);

  // Constants for current user session (In a real app, these come from your auth/profile state)
  const MY_BEACON_HASH = "A1B2C3D";
  const TOPIC_ID = 104; // e.g., Game Theory

  // ---------------------------------------------------------------------------
  // DEVICE A LOGIC (Broadcaster / GATT Server)
  // ---------------------------------------------------------------------------
  const handleToggleBroadcast = async () => {
    if (isBroadcasting) {
      await stopBroadcasting();
      myServerPrivateKey.current = null;
    } else {
      // 1. Generate an ephemeral keypair for this broadcast session
      const { secretKey: privateKey, publicKey } = x25519.keygen();

      myServerPrivateKey.current = privateKey;
      const myPublicKeyBase64 = Buffer.from(publicKey).toString("base64");

      // 2. Start the GATT server and advertise the iBeacon
      await startBroadcasting(TOPIC_ID, MY_BEACON_HASH, myPublicKeyBase64);
    }
  };

  // Listen for the Scanner (Device B) writing their public key to our GATT Server
  useEffect(() => {
    const handlePeerConnection = async () => {
      if (peerPublicKey && myServerPrivateKey.current) {
        try {
          console.log("Deriving shared secret on Broadcaster side...");
          const peerPublicKeyBytes = Uint8Array.from(
            Buffer.from(peerPublicKey, "base64"),
          );

          // Compute identical shared secret
          const sharedSecret = x25519.getSharedSecret(
            myServerPrivateKey.current,
            peerPublicKeyBytes,
          );
          const sharedSecretHex = Buffer.from(sharedSecret).toString("hex");

          const newEncounterId = Crypto.randomUUID();

          // Log encounter locally
          await localDb.insert(localEncounters).values({
            id: newEncounterId,
            peerBeaconHash: "UNKNOWN_UNTIL_SYNC", // Peripheral doesn't inherently know Central's hash
            topicId: TOPIC_ID.toString(),
            p2pSessionKeyHash: sharedSecretHex,
            startedAt: Math.floor(Date.now() / 1000),
            status: "active",
            syncStatus: 0,
          });

          await stopBroadcasting();

          // Navigate to Chat
          navigation.navigate("ChatScreen", {
            deviceId: "PERIPHERAL_MODE", // We rely on the Central's connection to maintain the link
            sharedSecretHex,
            encounterId: newEncounterId,
            bleManager,
          });
        } catch (error) {
          console.error("Failed to derive secret on server side:", error);
          Alert.alert("Handshake Error", "Could not secure the connection.");
        }
      }
    };

    handlePeerConnection();
  }, [peerPublicKey]);

  // ---------------------------------------------------------------------------
  // DEVICE B LOGIC (Scanner / GATT Central)
  // ---------------------------------------------------------------------------
  const handleToggleScan = () => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning(MY_BEACON_HASH);
    }
  };

  const handleConnect = async (peer: DiscoveredPeer) => {
    // 1. Connect and execute the ECDH swap
    const result = await performHandshake(bleManager, peer.deviceId);

    if (result.success && result.sharedSecret) {
      const newEncounterId = Crypto.randomUUID();

      // 2. Log encounter locally
      await localDb.insert(localEncounters).values({
        id: newEncounterId,
        peerBeaconHash: peer.beaconHash,
        topicId: peer.topicCategory,
        p2pSessionKeyHash: result.sharedSecret,
        startedAt: Math.floor(Date.now() / 1000),
        status: "active",
        syncStatus: 0,
      });

      // 3. Navigate to Chat UI
      navigation.navigate("ChatScreen", {
        deviceId: peer.deviceId,
        sharedSecretHex: result.sharedSecret,
        encounterId: newEncounterId,
        bleManager,
      });
    } else {
      Alert.alert(
        "Connection Dropped",
        "The passenger might have walked out of range.",
      );
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER UI
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <StatusBar barStyle="light-content" />
      <View className="flex-1 px-5 pt-8">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-slate-100">MetroChat</Text>
          <Text className="text-sm text-slate-400 mt-1">
            Discover passengers sharing your discussion topic nearby
          </Text>
        </View>

        {/* Action Controls */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleToggleBroadcast}
            disabled={isScanning}
            className={`flex-1 py-3 px-4 rounded-xl items-center justify-center ${
              isBroadcasting
                ? "bg-amber-600"
                : isScanning
                  ? "bg-slate-800 opacity-50"
                  : "bg-slate-800 border border-slate-700"
            }`}
          >
            <Text className="text-white font-semibold text-sm">
              {isBroadcasting ? "Stop Beacon" : "Broadcast Topic"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleToggleScan}
            disabled={isBroadcasting}
            className={`flex-1 py-3 px-4 rounded-xl items-center justify-center ${
              isScanning
                ? "bg-rose-600"
                : isBroadcasting
                  ? "bg-slate-800 opacity-50"
                  : "bg-indigo-600"
            }`}
          >
            <Text className="text-white font-semibold text-sm">
              {isScanning ? "Stop Scan" : "Scan Coach"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Discovery Feed */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Nearby Passengers ({discoveredPeers.length})
            </Text>
            {isScanning && (
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-emerald-400" />
                <Text className="text-xs text-slate-400">Listening...</Text>
              </View>
            )}
          </View>

          <FlatList
            data={discoveredPeers}
            keyExtractor={(item) => item.beaconHash}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3 flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <View className="self-start px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 mb-1.5">
                    <Text className="text-sky-400 text-[10px] font-bold uppercase">
                      {item.topicCategory}
                    </Text>
                  </View>
                  <Text
                    className="text-slate-100 font-semibold text-base"
                    numberOfLines={1}
                  >
                    {item.topicTitle}
                  </Text>
                  <Text className="text-slate-400 text-xs mt-1">
                    Signal:{" "}
                    {item.rssi !== null ? `${item.rssi} dBm` : "Unknown"}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleConnect(item)}
                  className="bg-emerald-600 py-2.5 px-4 rounded-xl items-center justify-center"
                >
                  <Text className="text-white font-semibold text-sm">Talk</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center py-20 px-4">
                <Text className="text-slate-400 text-sm text-center">
                  {isScanning
                    ? "Searching for nearby beacons in your metro coach..."
                    : "No passengers detected. Start scanning to find conversations."}
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
