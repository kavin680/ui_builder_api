import { BaseDecoder } from './base.decoder';
import { StandardMessage } from '../message-decoder.service';

export class HexDecoder extends BaseDecoder {
  getName(): string { return 'HEX'; }

  canHandle(message: string): boolean {
    return /^[0-9A-Fa-f]+$/.test(message);
  }

  decode(sourceId: string, topic: string, message: string, limit?: number): StandardMessage {
    const chunkSize = 2; // Default to byte chunks
    const numChunks = Math.ceil(message.length / chunkSize);
    const finalLimit = limit && limit > 0 ? Math.min(limit, numChunks) : numChunks;

    const values = new Array(finalLimit);
    for (let i = 0; i < finalLimit; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, message.length);
      const chunk = message.substring(start, end);
      values[i] = chunk.toUpperCase().padEnd(chunkSize, '0');
    }

    return { sourceId, topic, values, timestamp: new Date() };
  }
}
