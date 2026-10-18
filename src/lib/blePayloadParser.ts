import { Buffer } from "buffer";

export interface DiscoveredPeerPayload {
  topicId: number;
  beaconHash: string;
  statusFlag: number;
}

export function parseManufacturerData(
  base64Data: string | null
): DiscoveredPeerPayload | null {
  if (!base64Data) return null;

  try {
    const buffer = Buffer.from(base64Data, "base64");

    // iBeacon packets are exactly 25 bytes long.
    // Bytes 0-1: Company ID (0x004C for Apple, or 0x00E0 for Android tests)
    // Byte 2: Type (0x02 for iBeacon)
    // Byte 3: Length (0x15 / 21 bytes)
    if (buffer.length < 25 || buffer[2] !== 0x02) {
      return null;
    }

    // Bytes 4-19 (16 bytes): The UUID
    // Our custom UUID format: 12345678-1234-1234-1234-[beaconHash]
    // The beaconHash is in the last 6 bytes (bytes 14-19 of the UUID, which is bytes 14-19 in the buffer)
    const uuidHex = buffer.toString("hex", 4, 20);

    // Check if it's our MetroChat prefix (12345678123412341234)
    if (!uuidHex.startsWith("12345678123412341234")) {
      return null;
    }

    // Extract the beacon hash from the end of the UUID, remove the padding '0's
    // hex characters 20 to 32 map to the last 6 bytes
    let beaconHash = buffer.toString("ascii", 14, 20).replace(/0+$/, "");

    // Bytes 20-21: Major number (Maps to our Topic ID)
    const topicId = buffer.readUInt16BE(20);

    // Bytes 22-23: Minor number (Maps to our Status Flag)
    const statusFlag = buffer.readUInt16BE(22);

    return {
      topicId,
      beaconHash,
      statusFlag,
    };
  } catch (err) {
    console.warn("Failed to parse iBeacon packet:", err);
    return null;
  }
}
