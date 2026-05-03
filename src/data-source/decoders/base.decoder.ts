import { StandardMessage } from '../message-decoder.service';

export interface IDecoder {
  getName(): string;
  canHandle(message: string): boolean;
  decode(sourceId: string, topic: string, message: string, limit?: number): StandardMessage;
}

export abstract class BaseDecoder implements IDecoder {
  abstract getName(): string;
  abstract canHandle(message: string): boolean;
  abstract decode(sourceId: string, topic: string, message: string, limit?: number): StandardMessage;

  protected toString(value: unknown): string {
    if (value === null || value === undefined) return '0';
    return String(value);
  }
}
