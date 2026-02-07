declare module 'lz4js' {
  export function compress(input: Uint8Array | Buffer | number[]): Uint8Array;
  export function decompress(input: Uint8Array | Buffer | number[]): Uint8Array;
}
