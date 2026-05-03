import { Injectable, OnModuleInit } from '@nestjs/common';
import { IDecoder } from './decoders/base.decoder';
import { JsonDecoder } from './decoders/json.decoder';
import { HexDecoder } from './decoders/hex.decoder';
import { KvDecoder } from './decoders/kv.decoder';

export interface StandardMessage {
  sourceId: string;
  topic: string;
  values: string[];
  timestamp: Date;
}

@Injectable()
export class MessageDecoderService implements OnModuleInit {
  private decoders: IDecoder[] = [];

  onModuleInit() {
    // We register decoders in order of priority. 
    // JSON is most common, so we check it first. 
    // Hex is last as it's a fallback for binary-like strings.
    this.decoders = [
      new JsonDecoder(),
      new KvDecoder(),
      new HexDecoder(),
    ];
  }

  decode(
    sourceId: string,
    topic: string,
    message: Buffer,
    maxReadingVariables?: number,
  ): StandardMessage {
    const raw = message.toString().trim();
    const timestamp = new Date();

    if (!raw || raw.length > 20000) {
      return { sourceId, topic, values: [], timestamp };
    }

    // This is the "Chain of Responsibility" pattern. 
    // We try each decoder until one successfully parses the payload.
    for (const decoder of this.decoders) {
      if (decoder.canHandle(raw)) {
        try {
          return decoder.decode(sourceId, topic, raw, maxReadingVariables);
        } catch (err) {
          // If a decoder matches but fails internally (e.g. invalid JSON syntax),
          // we don't crash. We just move on to the next possibility.
          continue;
        }
      }
    }

    // Default: Plain text
    return {
      sourceId,
      topic,
      values: [raw],
      timestamp,
    };
  }
}
