import { BaseDecoder } from './base.decoder';
import { StandardMessage } from '../message-decoder.service';

export class JsonDecoder extends BaseDecoder {
  getName(): string { return 'JSON'; }

  canHandle(message: string): boolean {
    try {
      const parsed = JSON.parse(message);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }

  decode(sourceId: string, topic: string, message: string, limit?: number): StandardMessage {
    const parsed = JSON.parse(message);
    const keys = Object.keys(parsed).sort();
    const finalLimit = limit && limit > 0 ? Math.min(limit, keys.length) : keys.length;
    
    const values = new Array(finalLimit);
    for (let i = 0; i < finalLimit; i++) {
      values[i] = this.toString(parsed[keys[i]]);
    }
    
    return { sourceId, topic, values, timestamp: new Date() };
  }
}
