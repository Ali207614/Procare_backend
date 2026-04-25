import { Request } from 'express';

export function getClientIp(req: Request): string {
  const ip = req.ips?.[0] ?? req.ip ?? req.socket.remoteAddress ?? 'unknown-ip';

  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }

  return ip;
}
