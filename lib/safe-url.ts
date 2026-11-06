import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// SSRF guard: paid users must not be able to point our browser at internal hosts.
const PRIVATE_V4 = [
  [0x0a000000, 8], [0x7f000000, 8], [0xac100000, 12], [0xc0a80000, 16],
  [0xa9fe0000, 16], [0x00000000, 8], [0x64400000, 10], [0xe0000000, 4],
] as const;

function v4ToInt(ip: string) {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}

export function isPrivateIp(ip: string) {
  if (isIP(ip) === 4) {
    const n = v4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => n >>> (32 - bits) === base >>> (32 - bits));
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlError(`Invalid URL: ${raw}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new UrlError("Only http(s) URLs are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal"))
    throw new UrlError("Private hosts are not allowed");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new UrlError(`Cannot resolve host: ${host}`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new UrlError("Private hosts are not allowed");
  return url;
}

export class UrlError extends Error {}
