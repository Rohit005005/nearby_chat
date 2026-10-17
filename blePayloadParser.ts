import { Buffer } from "buffer";

export interface DiscoveredPeerPayload {
  topicId: number;
  beaconHash: string;
  statusFlag: number;
}

export function parseManufacturerData(
  base64Data: string | null,
): DiscoveredPeerPayload | null {
  if (!base64Data) return null;

  try {
    const buffer = Buffer.from(base64Data, "base64");

    // Standard BLE manufacturer data format:
    // Bytes 0-1: Company Identifier Code (2 bytes)
    // Bytes 2-3: Topic ID (2 bytes, UInt16)
    // Bytes 4-10: Ephemeral Beacon Hash (7 bytes ASCII)
    // Byte 11: Status Flag (1 byte, UInt8)
    if (buffer.length < 12) {
      return null;
    }

    // Skip the 2-byte Company ID
    const topicId = buffer.readUInt16BE(2);
    const beaconHash = buffer.toString("ascii", 4, 11);
    const statusFlag = buffer.readUInt8(11);

    return {
      topicId,
      beaconHash,
      statusFlag,
    };
  } catch (err) {
    console.warn("Failed to parse BLE packet:", err);
    return null;
  }
}
