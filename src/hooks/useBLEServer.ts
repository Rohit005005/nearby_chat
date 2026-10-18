import { useState, useEffect } from 'react';
import BlePeripheral from 'react-native-ble-peripheral';
import { DeviceEventEmitter, Platform } from 'react-native';
import { Buffer } from 'buffer';

const METRO_CHAT_SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const HANDSHAKE_CHARACTERISTIC_UUID = "abcdefab-1234-1234-1234-1234567890ab";
const MESSAGE_CHARACTERISTIC_UUID = "11111111-2222-3333-4444-555555555555";
const METRO_CHAT_PREFIX = "12345678-";

export default function useBLEServer() {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [peerPublicKey, setPeerPublicKey] = useState<string | null>(null);

  // Initialize the GATT Server on mount
  useEffect(() => {
    // 1. Define the Service and Characteristics we want to expose
    BlePeripheral.addService(METRO_CHAT_SERVICE_UUID, true);

    // The handshake slot: Central (Device B) writes to it, and reads from it
    BlePeripheral.addCharacteristicToService(
      METRO_CHAT_SERVICE_UUID,
      HANDSHAKE_CHARACTERISTIC_UUID,
      16 | 8 | 2, // Permissions: read | write | notify
      8 // Properties: write
    );

    // The messaging slot: Central (Device B) writes to it, and we send notifications from it
    BlePeripheral.addCharacteristicToService(
      METRO_CHAT_SERVICE_UUID,
      MESSAGE_CHARACTERISTIC_UUID,
      16 | 8 | 2, // Permissions: read | write | notify
      8 // Properties: write
    );

    // 2. Listen for incoming WRITE requests from Device B
    const writeListener = DeviceEventEmitter.addListener(
      'WriteValueForCharacteristic',
      (req) => {
        const { characteristic, value } = req;

        if (characteristic === HANDSHAKE_CHARACTERISTIC_UUID) {
          console.log("Received Peer's Public Key!");
          // 'value' arrives as a base64 string. Save it to state so your handshake logic can use it.
          setPeerPublicKey(value);
        }

        if (characteristic === MESSAGE_CHARACTERISTIC_UUID) {
          console.log("Received Encrypted Chat Message!");
          // You will route this to your chat decryption function
          // handleReceiveEncryptedMessage(value);
        }
      }
    );

    return () => {
      writeListener.remove();
    };
  }, []);

  const startBroadcasting = async (topicId: number, beaconHash: string, myPublicKeyBase64: string) => {
    try {
      // 1. Pre-load YOUR public key into the handshake characteristic
      // so Device B can read it immediately upon connecting.
      BlePeripheral.updateValueForCharacteristic(
        HANDSHAKE_CHARACTERISTIC_UUID,
        myPublicKeyBase64
      );

      // 2. Start broadcasting the iBeacon discovery payload
      const dynamicUUID = `${METRO_CHAT_PREFIX}1234-1234-1234-${beaconHash.padEnd(12, '0')}`;

      // Some Android devices require a device name
      BlePeripheral.setName('MetroChat');

      await BlePeripheral.start({
        serviceUuids: [dynamicUUID],
        // We pack topicId and statusFlag into the manufacturer data if the API supports it,
        // or we rely purely on the UUID string resolution for matching.
      });

      setIsBroadcasting(true);
      console.log(`GATT Server running & broadcasting Topic: ${topicId}`);
    } catch (error) {
      console.error('Failed to start GATT server:', error);
      setIsBroadcasting(false);
    }
  };

  const stopBroadcasting = async () => {
    try {
      await BlePeripheral.stop();
      setIsBroadcasting(false);
      console.log('Stopped GATT server');
    } catch (error) {
      console.error('Failed to stop GATT server:', error);
    }
  };

  return {
    startBroadcasting,
    stopBroadcasting,
    isBroadcasting,
    peerPublicKey // Expose this so your UI knows when a peer has successfully sent their key
  };
}
