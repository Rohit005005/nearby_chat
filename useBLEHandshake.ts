// useBLEHandshake.ts
import { BleManager, Device } from "react-native-ble-plx";
import { x25519 } from "@noble/curves/ed25519.js";
import { Buffer } from "buffer";

// The Service UUID we used in the scanner
const METRO_CHAT_SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
// A new UUID specifically for swapping keys
const HANDSHAKE_CHARACTERISTIC_UUID = "abcdefab-1234-1234-1234-1234567890ab";

export const performHandshake = async (
  bleManager: BleManager,
  deviceId: string
) => {
  try {
    console.log(`Connecting to device: ${deviceId}...`);

    // 1. Establish the direct BLE Connection
    const device: Device = await bleManager.connectToDevice(deviceId);
    console.log("Connected! Discovering services...");

    // 2. Discover the GATT Server layout
    await device.discoverAllServicesAndCharacteristics();

    // 3. Generate MY ephemeral ECDH key pair for this specific encounter
    const myPrivateKey = x25519.keygen();
    const myPublicKey = x25519.getPublicKey(myPrivateKey);
    const myPublicKeyBase64 = Buffer.from(myPublicKey).toString("base64");

    // 4. Swap Keys
    // Write MY public key to their device
    await bleManager.writeCharacteristicWithResponseForDevice(
      device.id,
      METRO_CHAT_SERVICE_UUID,
      HANDSHAKE_CHARACTERISTIC_UUID,
      myPublicKeyBase64
    );

    // Read THEIR public key from their device
    const characteristic = await bleManager.readCharacteristicForDevice(
      device.id,
      METRO_CHAT_SERVICE_UUID,
      HANDSHAKE_CHARACTERISTIC_UUID
    );

    if (!characteristic.value) {
      throw new Error("Failed to read peer public key");
    }

    const peerPublicKeyBytes = Uint8Array.from(
      Buffer.from(characteristic.value, "base64")
    );

    // 5. Derive the Shared Secret
    // This function combines MY private key and THEIR public key.
    // The peer is doing the exact same thing on their side. Both result in the exact same 32-byte secret.
    const sharedSecret = x25519.getSharedSecret(myPrivateKey, peerPublicKeyBytes);

    // Convert to a hex string to store in your local SQLite DB
    const sharedSecretHex = Buffer.from(sharedSecret).toString("hex");
    console.log("Secure Handshake Complete! Shared Secret derived.");

    return {
      success: true,
      sharedSecret: sharedSecretHex,
      device
    };

  } catch (error) {
    console.error("Handshake failed:", error);
    return { success: false, error };
  }
};
