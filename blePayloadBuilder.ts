import { Buffer } from "buffer";

export function createBroadcastPayload(
  topicId: number,
  beaconHashStr: string,
  statusFlag: number,
): string {

  // Create a 10-byte buffer
  const buffer = Buffer.alloc(10);

  // Bytes 0-1: Topic ID (16-bit unsigned integer)
  buffer.writeUInt16BE(topicId, 0);

  // Bytes 2-8: Beacon Hash (7 bytes)
  buffer.write(beaconHashStr.substring(0, 7), 2, 7, "ascii");

  // Byte 9: Status Flag (8-bit unsigned integer)
  buffer.writeUInt8(statusFlag, 9);

  return buffer.toString("base64");
}
