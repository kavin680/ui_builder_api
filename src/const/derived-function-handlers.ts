// ===============================
// 🔹 Private Helpers (NOT exported)
// ===============================

type ByteOrder = 'ABCD' | 'BADC' | 'DCBA' | 'CDAB';

const BYTE_ORDERS: Record<ByteOrder, number[]> = {
  ABCD: [0, 1, 2, 3],
  BADC: [1, 0, 3, 2],
  DCBA: [3, 2, 1, 0],
  CDAB: [2, 3, 0, 1],
};

const floatFromOrder = (
  values: (string | number)[],
  order: ByteOrder,
): number => {
  if (!values || values.length !== 4) {
    throw new Error('Expected exactly 4 bytes');
  }

  const inputBytes = values.map((v) =>
    typeof v === 'string' ? parseInt(v, 16) : parseInt(v.toString(), 16),
  );

  const reordered = new Array<number>(4);

  BYTE_ORDERS[order].forEach((pos, i) => {
    reordered[pos] = inputBytes[i];
  });

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  reordered.forEach((b, i) => view.setUint8(i, b));

  return parseFloat(view.getFloat32(0, false).toFixed(2));
};

const floatToOrder = (
  values: (string | number)[],
  order: ByteOrder,
): string => {
  if (!values || values.length !== 1) {
    throw new Error('Expected exactly 1 value');
  }

  const value = Number(values[0]);

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  view.setFloat32(0, value, false);

  const bytes = [
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  ];

  return BYTE_ORDERS[order]
    .map((i) => bytes[i].toString(16).toUpperCase().padStart(2, '0'))
    .join('');
};

const hexToBit = (values: (string | number)[], bitIndex: number): number => {
  if (!values || values.length === 0) {
    throw new Error('No value provided');
  }

  if (bitIndex < 0 || bitIndex > 7) {
    throw new Error('Bit index must be between 0 and 7');
  }

  let num: number;

  if (typeof values[0] === 'string') {
    num = parseInt(values[0], 16);
  } else {
    num = values[0];
  }

  return (num >> bitIndex) & 1;
};

const bitToHex = (value: string, reverse = false): string => {
  if (typeof value !== 'string') {
    throw new Error('Value must be a string');
  }

  if (!/^[01]{8}$/.test(value)) {
    throw new Error('Input must be an 8-bit binary string');
  }

  const bin = reverse ? [...value].reverse().join('') : value;

  return parseInt(bin, 2).toString(16).toUpperCase().padStart(2, '0');
};

type TwoByteOrder = 'AB' | 'BA';

const hexToDecimal2Bytes = (
  values: (string | number)[],
  order: TwoByteOrder,
): number => {
  if (!values || values.length !== 2) {
    throw new Error('Expected exactly 2 bytes');
  }

  const bytes = values.map((v) =>
    typeof v === 'string' ? parseInt(v, 16) : parseInt(v.toString(), 16),
  );

  const [A, B] = order === 'AB' ? bytes : [bytes[1], bytes[0]];

  return (A << 8) | B;
};

const hexToSignedDecimal2Bytes = (
  values: (string | number)[],
  order: TwoByteOrder,
): number => {
  const unsigned = hexToDecimal2Bytes(values, order);
  return (unsigned << 16) >> 16;
};

const decimalToHex2Bytes = (
  values: (string | number)[],
  order: TwoByteOrder,
): string => {
  if (!values || values.length !== 1) {
    throw new Error('Expected exactly 1 value');
  }

  const num = Number(values[0]);

  if (num < 0 || num > 0xffff) {
    throw new Error('Value must be between 0 and 65535');
  }

  const A = (num >> 8) & 0xff;
  const B = num & 0xff;

  const ordered = order === 'AB' ? [A, B] : [B, A];

  return ordered
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
};

const bytesToFloat = (values: number[], order: ByteOrder): number => {
  if (!values || values.length !== 4) {
    throw new Error('Expected exactly 4 bytes');
  }

  const reordered = BYTE_ORDERS[order].map((i) => values[i]);

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  reordered.forEach((b, i) => view.setUint8(i, b));

  return view.getFloat32(0, false);
};
const floatToBytes = (
  values: (string | number)[],
  order: ByteOrder,
): number[] => {
  if (!values || values.length !== 1) {
    throw new Error('Expected exactly 1 value');
  }

  const value = Number(values[0]);

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  view.setFloat32(0, value, false);

  const bytes = [
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  ];

  return BYTE_ORDERS[order].map((i) => bytes[i]);
};

export type DerivedFunctionHandler = (
  values: (string | number)[],
) => string | number | number[];

export const DerivedFunctionHandlers: Record<string, DerivedFunctionHandler> = {
  floatABCD: (v) => floatFromOrder(v, 'ABCD'),
  floatBADC: (v) => floatFromOrder(v, 'BADC'),
  floatDCBA: (v) => floatFromOrder(v, 'DCBA'),
  floatCDAB: (v) => floatFromOrder(v, 'CDAB'),

  floatToABCD: (v) => floatToOrder(v, 'ABCD'),
  floatToBADC: (v) => floatToOrder(v, 'BADC'),
  floatToDCBA: (v) => floatToOrder(v, 'DCBA'),
  floatToCDAB: (v) => floatToOrder(v, 'CDAB'),

  HEX_TO_BIT_0: (v) => hexToBit(v, 0),
  HEX_TO_BIT_1: (v) => hexToBit(v, 1),
  HEX_TO_BIT_2: (v) => hexToBit(v, 2),
  HEX_TO_BIT_3: (v) => hexToBit(v, 3),
  HEX_TO_BIT_4: (v) => hexToBit(v, 4),
  HEX_TO_BIT_5: (v) => hexToBit(v, 5),
  HEX_TO_BIT_6: (v) => hexToBit(v, 6),
  HEX_TO_BIT_7: (v) => hexToBit(v, 7),

  BYTE: (v: (string | number)[]) =>
    bitToHex(String(v[0]).padStart(8, '0'), true),
  BYTE_SWAP: (v: (string | number)[]) =>
    bitToHex(String(v[0]).padStart(8, '0'), false),

  HEX_TO_DECIMAL_AB: (v) => hexToDecimal2Bytes(v, 'AB'),
  HEX_TO_DECIMAL_BA: (v) => hexToDecimal2Bytes(v, 'BA'),

  HEX_TO_SIGNED_DECIMAL_AB: (v) => hexToSignedDecimal2Bytes(v, 'AB'),
  HEX_TO_SIGNED_DECIMAL_BA: (v) => hexToSignedDecimal2Bytes(v, 'BA'),

  DECIMAL_TO_HEX_AB: (v) => decimalToHex2Bytes(v, 'AB'),
  DECIMAL_TO_HEX_BA: (v) => decimalToHex2Bytes(v, 'BA'),

  bytesToFloatABCD: (v) => bytesToFloat(v as number[], 'ABCD'),
  bytesToFloatDCBA: (v) => bytesToFloat(v as number[], 'DCBA'),
  bytesToFloatBADC: (v) => bytesToFloat(v as number[], 'BADC'),
  bytesToFloatCDAB: (v) => bytesToFloat(v as number[], 'CDAB'),

  floatToBytesABCD: (v) => floatToBytes(v, 'ABCD'),
  floatToBytesDCBA: (v) => floatToBytes(v, 'DCBA'),
  floatToBytesBADC: (v) => floatToBytes(v, 'BADC'),
  floatToBytesCDAB: (v) => floatToBytes(v, 'CDAB'),
};
