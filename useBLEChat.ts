// useBLEChat.ts
import { useState, useEffect } from "react";
import { BleManager } from "react-native-ble-plx";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/webcrypto.js";
import { Buffer } from "buffer";
import { localDb } from "./db/client";
import { localMessages } from "./db/schema";
import * as Crypto from "expo-crypto";

// The UUIDs we defined earlier
const METRO_CHAT_SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
// We need a specific characteristic just for messaging
const MESSAGE_CHARACTERISTIC_UUID = "11111111-2222-3333-4444-555555555555";

export default function useBLEChat(
  bleManager: BleManager,
  deviceId: string,
  sharedSecretHex: string,
  encounterId: string,
) {
  const [messages, setMessages] = useState<
    { id: string; text: string; isFromMe: boolean }[]
  >([]);

  // 1. Setup the AES-GCM Cipher using the shared secret
  const sharedSecretBytes = Uint8Array.from(
    Buffer.from(sharedSecretHex, "hex"),
  );

  // 2. Listen for incoming messages
  useEffect(() => {
    console.log("Setting up listener for incoming messages...");

    // monitorCharacteristicForDevice listens for push notifications from the peer
    const subscription = bleManager.monitorCharacteristicForDevice(
      deviceId,
      METRO_CHAT_SERVICE_UUID,
      MESSAGE_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error("Error receiving message:", error);
          return;
        }

        if (characteristic?.value) {
          handleReceiveEncryptedMessage(characteristic.value);
        }
      },
    );

    return () => {
      subscription.remove(); // Clean up listener when chat closes
    };
  }, [deviceId]);

  const handleReceiveEncryptedMessage = async (base64Payload: string) => {
    try {
      const payloadBytes = Uint8Array.from(
        Buffer.from(base64Payload, "base64"),
      );

      // Extract the 12-byte nonce/IV from the front of the payload
      const nonce = payloadBytes.slice(0, 12);
      const ciphertext = payloadBytes.slice(12);

      // Decrypt the message
      const cipher = gcm(sharedSecretBytes, nonce);
      const decryptedBytes = cipher.decrypt(ciphertext);
      const decryptedText = Buffer.from(decryptedBytes).toString("utf-8");

      const newMessageId = Crypto.randomUUID();

      // Update UI
      setMessages((prev) => [
        ...prev,
        { id: newMessageId, text: decryptedText, isFromMe: false },
      ]);

      // Save to local SQLite Queue for cloud syncing later
      await localDb.insert(localMessages).values({
        id: newMessageId,
        encounterId: encounterId,
        isFromMe: false,
        encryptedPayload: base64Payload, // Save the raw payload for the server audit log
        clientSequenceNumber: Date.now(),
        sentAt: Math.floor(Date.now() / 1000),
        syncStatus: 0, // PENDING
      });
    } catch (err) {
      console.error("Failed to decrypt incoming message:", err);
    }
  };

  const sendMessage = async (text: string) => {
    try {
      // 1. Encrypt the text
      const nonce = randomBytes(12); // AES-GCM requires a unique 12-byte IV per message
      const textBytes = Uint8Array.from(Buffer.from(text, "utf-8"));

      const cipher = gcm(sharedSecretBytes, nonce);
      const ciphertext = cipher.encrypt(textBytes);

      // Combine nonce and ciphertext so the receiver can decrypt it
      const combinedPayload = new Uint8Array(nonce.length + ciphertext.length);
      combinedPayload.set(nonce);
      combinedPayload.set(ciphertext, nonce.length);

      const payloadBase64 = Buffer.from(combinedPayload).toString("base64");

      // 2. Send over Bluetooth
      await bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        METRO_CHAT_SERVICE_UUID,
        MESSAGE_CHARACTERISTIC_UUID,
        payloadBase64,
      );

      const newMessageId = Crypto.randomUUID();

      // 3. Update UI
      setMessages((prev) => [
        ...prev,
        { id: newMessageId, text, isFromMe: true },
      ]);

      // 4. Save to local SQLite Queue
      await localDb.insert(localMessages).values({
        id: newMessageId,
        encounterId: encounterId,
        isFromMe: true,
        encryptedPayload: payloadBase64,
        clientSequenceNumber: Date.now(),
        sentAt: Math.floor(Date.now() / 1000),
        syncStatus: 0, // PENDING
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. The peer might have disconnected.");
    }
  };

  return {
    messages,
    sendMessage,
  };
}
