import { useState } from 'react';
import BleAdvertise from 'react-native-ble-advertise';
import { Platform } from 'react-native';

const APPLE_COMPANY_ID = 0x004C;
const ANDROID_COMPANY_ID = 0x00E0;

// A static prefix for all MetroChat users (first 8 chars of a UUID)
const METRO_CHAT_PREFIX = "12345678-";

export default function useBLEBroadcaster() {
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const startBroadcasting = async (topicId: number, beaconHash: string, statusFlag: number = 1) => {
    try {
      BleAdvertise.setCompanyId(
        Platform.OS === 'ios' ? APPLE_COMPANY_ID : ANDROID_COMPANY_ID
      );

      // 1. Construct a valid UUID format using your beaconHash
      // iBeacon UUID format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (36 chars total including hyphens)
      // Assuming beaconHash is 7 chars (e.g. "A1B2C3D"), we pad it to fill the rest of the UUID format
      const dynamicUUID = `${METRO_CHAT_PREFIX}1234-1234-1234-${beaconHash.padEnd(12, '0')}`;

      // 2. Broadcast with the 3 required arguments (UUID, Major, Minor)
      await BleAdvertise.broadcast(
        dynamicUUID,  // Arg 1: The dynamic UUID containing the beaconHash
        topicId,      // Arg 2: Major number (0-65535)
        statusFlag    // Arg 3: Minor number (0-65535)
      );

      setIsBroadcasting(true);
      console.log(`Now broadcasting Topic: ${topicId} with UUID: ${dynamicUUID}`);
    } catch (error) {
      console.error('Failed to start broadcasting:', error);
      setIsBroadcasting(false);
    }
  };

  const stopBroadcasting = async () => {
    try {
      await BleAdvertise.stopBroadcast();
      setIsBroadcasting(false);
      console.log('Stopped broadcasting');
    } catch (error) {
      console.error('Failed to stop broadcasting:', error);
    }
  };

  return {
    startBroadcasting,
    stopBroadcasting,
    isBroadcasting
  };
}
