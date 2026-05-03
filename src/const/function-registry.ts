export type FunctionUsage = 'READ' | 'WRITE' | 'BOTH';

export interface FunctionDefinition {
  name: string;
  paramCount: number;
  usage: FunctionUsage;
  handler?: string; // Name of handler if different, or just use key
}

export const FUNCTION_REGISTRY: Record<string, FunctionDefinition> = {
  // Data Types / Write Formats
  // BYTE: { name: 'BYTE', paramCount: 1, usage: 'WRITE' },
  // INT: { name: 'INT', paramCount: 2, usage: 'WRITE' },
  // REAL: { name: 'REAL', paramCount: 4, usage: 'WRITE' },

  // Conversion / Decoding (Reading)
  HEX_TO_DECIMAL: { name: 'HEX_TO_DECIMAL', paramCount: 1, usage: 'READ' },
  BYTE_TO_REAL: { name: 'BYTE_TO_REAL', paramCount: 4, usage: 'READ' },

  bytesToFloatABCD: { name: 'bytesToFloatABCD', paramCount: 4, usage: 'READ' },
  bytesToFloatDCBA: { name: 'bytesToFloatDCBA', paramCount: 4, usage: 'READ' },

  floatABCD: { name: 'floatABCD', paramCount: 4, usage: 'READ' },
  floatDCBA: { name: 'floatDCBA', paramCount: 4, usage: 'READ' },
  floatBADC: { name: 'floatBADC', paramCount: 4, usage: 'READ' },
  floatCDAB: { name: 'floatCDAB', paramCount: 4, usage: 'READ' },

  HEX_TO_INDEX: { name: 'HEX_TO_INDEX', paramCount: 1, usage: 'READ' },

  // Bit Extraction
  HEX_TO_BIT_7: { name: 'HEX_TO_BIT_7', paramCount: 1, usage: 'READ' },
  HEX_TO_BIT_6: { name: 'HEX_TO_BIT_6', paramCount: 1, usage: 'READ' },
  HEX_TO_BIT_5: { name: 'HEX_TO_BIT_5', paramCount: 1, usage: 'READ' },
  HEX_TO_BIT_4: { name: 'HEX_TO_BIT_4', paramCount: 1, usage: 'READ' },
  HEX_TO_BIT_3: { name: 'HEX_TO_BIT_3', paramCount: 1, usage: 'READ' },
  HEX_TO_BIT_2: { name: 'HEX_TO_BIT_2', paramCount: 1, usage: 'READ' },
  HEX_TO_BIT_1: { name: 'HEX_TO_BIT_1', paramCount: 1, usage: 'READ' },
  HEX_TO_BIT_0: { name: 'HEX_TO_BIT_0', paramCount: 1, usage: 'READ' },

  HEX_TO_DECIMAL_AB: {
    name: 'HEX_TO_DECIMAL_AB',
    paramCount: 2,
    usage: 'READ',
  },
  HEX_TO_DECIMAL_BA: {
    name: 'HEX_TO_DECIMAL_BA',
    paramCount: 2,
    usage: 'READ',
  },

  floatToABCD: { name: 'floatToABCD', paramCount: 1, usage: 'WRITE' },
  floatToDCBA: { name: 'floatToDCBA', paramCount: 1, usage: 'WRITE' },
  floatToBADC: { name: 'floatToBADC', paramCount: 1, usage: 'WRITE' },
  floatToCDAB: { name: 'floatToCDAB', paramCount: 1, usage: 'WRITE' },

  DECIMAL_TO_HEX_AB: {
    name: 'DECIMAL_TO_HEX_AB',
    paramCount: 1,
    usage: 'WRITE',
  },
  DECIMAL_TO_HEX_BA: {
    name: 'DECIMAL_TO_HEX_BA',
    paramCount: 1,
    usage: 'WRITE',
  },

  // BIT_TO_HEX_7: { name: 'BIT_TO_HEX_7', paramCount: 1, usage: 'WRITE' },
  // BIT_TO_HEX_6: { name: 'BIT_TO_HEX_6', paramCount: 1, usage: 'WRITE' },
  // BIT_TO_HEX_5: { name: 'BIT_TO_HEX_5', paramCount: 1, usage: 'WRITE' },
  // BIT_TO_HEX_4: { name: 'BIT_TO_HEX_4', paramCount: 1, usage: 'WRITE' },
  // BIT_TO_HEX_3: { name: 'BIT_TO_HEX_3', paramCount: 1, usage: 'WRITE' },
  // BIT_TO_HEX_2: { name: 'BIT_TO_HEX_2', paramCount: 1, usage: 'WRITE' },
  // BIT_TO_HEX_1: { name: 'BIT_TO_HEX_1', paramCount: 1, usage: 'WRITE' },
  // BIT_TO_HEX_0: { name: 'BIT_TO_HEX_0', paramCount: 1, usage: 'WRITE' },

  BYTE: { name: 'BYTE', paramCount: 1, usage: 'WRITE' },
  BYTE_SWAP: { name: 'BYTE_SWAP', paramCount: 2, usage: 'WRITE' },
};

export enum DerivedFunction {
  HEX_TO_DECIMAL = 'HEX_TO_DECIMAL',
  BYTE_TO_REAL = 'BYTE_TO_REAL',
  bytesToFloatABCD = 'bytesToFloatABCD',
  bytesToFloatDCBA = 'bytesToFloatDCBA',
  floatABCD = 'floatABCD',
  floatDCBA = 'floatDCBA',
  floatBADC = 'floatBADC',
  floatCDAB = 'floatCDAB',
  HEX_TO_INDEX = 'HEX_TO_INDEX',
  HEX_TO_BIT_7 = 'HEX_TO_BIT_7',
  HEX_TO_BIT_6 = 'HEX_TO_BIT_6',
  HEX_TO_BIT_5 = 'HEX_TO_BIT_5',
  HEX_TO_BIT_4 = 'HEX_TO_BIT_4',
  HEX_TO_BIT_3 = 'HEX_TO_BIT_3',
  HEX_TO_BIT_2 = 'HEX_TO_BIT_2',
  HEX_TO_BIT_1 = 'HEX_TO_BIT_1',
  HEX_TO_BIT_0 = 'HEX_TO_BIT_0',
  HEX_TO_DECIMAL_AB = 'HEX_TO_DECIMAL_AB',
  HEX_TO_DECIMAL_BA = 'HEX_TO_DECIMAL_BA',
  floatToABCD = 'floatToABCD',
  floatToDCBA = 'floatToDCBA',
  floatToBADC = 'floatToBADC',
  floatToCDAB = 'floatToCDAB',
  DECIMAL_TO_HEX_AB = 'DECIMAL_TO_HEX_AB',
  DECIMAL_TO_HEX_BA = 'DECIMAL_TO_HEX_BA',
  BYTE = 'BYTE',
  BYTE_SWAP = 'BYTE_SWAP',
}

export const PARAMETER_COUNT_MAP: Record<string, number> = {};
Object.values(FUNCTION_REGISTRY).forEach((def) => {
  PARAMETER_COUNT_MAP[def.name] = def.paramCount;
});

export function getParameterCount(
  name: string | null | undefined,
): number | undefined {
  if (!name) return undefined;
  return PARAMETER_COUNT_MAP[name];
}
