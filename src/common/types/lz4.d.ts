declare module 'lz4' {
  export function encode(data: string | Buffer): Buffer;
  export function decode(data: Buffer): Buffer;
}

