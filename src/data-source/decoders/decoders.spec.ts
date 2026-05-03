import { JsonDecoder } from './json.decoder';
import { HexDecoder } from './hex.decoder';
import { KvDecoder } from './kv.decoder';

describe('Message Decoders', () => {
  describe('JsonDecoder', () => {
    const decoder = new JsonDecoder();
    it('should handle valid JSON', () => {
      expect(decoder.canHandle('{"a":1,"b":2}')).toBe(true);
    });
    it('should decode JSON values sorted by key', () => {
      const result = decoder.decode('src', 'topic', '{"b":2,"a":1}');
      expect(result.values).toEqual(['1', '2']);
    });
  });

  describe('HexDecoder', () => {
    const decoder = new HexDecoder();
    it('should handle valid HEX', () => {
      expect(decoder.canHandle('AABBCC')).toBe(true);
    });
    it('should decode HEX into bytes', () => {
      const result = decoder.decode('src', 'topic', 'AABBCC');
      expect(result.values).toEqual(['AA', 'BB', 'CC']);
    });
  });

  describe('KvDecoder', () => {
    const decoder = new KvDecoder();
    it('should handle KV format', () => {
      expect(decoder.canHandle('k1=v1,k2=v2')).toBe(true);
    });
    it('should decode KV pairs', () => {
      const result = decoder.decode('src', 'topic', 'v1=10,v2=20');
      expect(result.values).toEqual(['10', '20']);
    });
  });
});
