import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import useBLE, { DiscoveredPeer } from "../useBLE";
import useBLEBroadcaster from "../useBLEBroadcaster";

export default function MetroScreen() {
  const { startScanning, stopScanning, isScanning, discoveredPeers } = useBLE();
  const { startBroadcasting, stopBroadcasting, isBroadcasting } =
    useBLEBroadcaster();

  const handleToggleBroadcast = async () => {
    if (isBroadcasting) {
      await stopBroadcasting();
    } else {
      const TOPIC_ID = 104; // e.g., Game Theory
      const MY_BEACON_HASH = "A1B2C3D";
      await startBroadcasting(TOPIC_ID, MY_BEACON_HASH);
    }
  };

  const handleToggleScan = () => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning("A1B2C3D");
    }
  };

  const handleConnect = (peer: DiscoveredPeer) => {
    console.log("Initiating P2P handshake with device:", peer.deviceId);
  };

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
            className={`flex-1 py-3 px-4 rounded-xl items-center justify-center ${
              isBroadcasting
                ? "bg-amber-600"
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
            className={`flex-1 py-3 px-4 rounded-xl items-center justify-center ${
              isScanning ? "bg-rose-600" : "bg-indigo-600"
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
                    : "No passengers detected. Start scanning to find nearby conversations."}
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
