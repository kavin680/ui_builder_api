import { BaseDecoder } from './base.decoder';
import { StandardMessage } from '../message-decoder.service';

export class KvDecoder extends BaseDecoder {
  getName(): string { return 'KV'; }

  canHandle(message: string): boolean {
    return message.includes('=') && message.includes(',');
  }

  decode(sourceId: string, topic: string, message: string, limit?: number): StandardMessage {
    const pairs = message.split(',');
    const finalLimit = limit && limit > 0 ? Math.min(limit, pairs.length) : pairs.length;

    const values = new Array(finalLimit);
    for (let i = 0; i < finalLimit; i++) {
      const [, value] = pairs[i].split('=');
      values[i] = this.toString(value?.trim());
    }

    return { sourceId, topic, values, timestamp: new Date() };
  }
}
