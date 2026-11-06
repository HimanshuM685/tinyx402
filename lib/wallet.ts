import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAddress, type Hex } from "viem";
import { db } from "./db";
import { wallets } from "./schema";
import { CHAINS, isNetwork, type Network } from "./chains";

/**
 * Platform wallets for Google users (custodial, testnet). The key is generated server-side,
 * stored AES-256-GCM encrypted (AAD = user id, so rows can't be swapped), and only ever used
 * to sign an EIP-3009 transfer, on an allowlisted chain, to this deployment's PAY_TO_ADDRESS.
 * It cannot sign anything else.
 */

function encKey() {
  const k = Buffer.from(process.env.WALLET_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("WALLET_ENCRYPTION_KEY must be 32 bytes, base64 (openssl rand -base64 32)");
  return k;
}

export function encrypt(plain: string, userId: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv).setAAD(Buffer.from(userId));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(".");
}

export function decrypt(blob: string, userId: string) {
  const [iv, tag, ct] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", encKey(), iv).setAAD(Buffer.from(userId));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

/**
 * The three ways wallet storage is not ready, each needing a different fix, so a signed-in user
 * is told which one instead of a generic "not configured". Names no secret — only which setting
 * is absent — and only a signed-in caller ever sees it.
 */
export function walletErrorHint(msg: string) {
  if (msg.includes("DATABASE_URL")) return "Signed in, but DATABASE_URL is not set on the server.";
  if (/relation .* does not exist|undefined_table|42P01/i.test(msg)) return "Signed in, but the wallets table is missing \u2014 the database needs `pnpm db:push`.";
  if (msg.includes("WALLET_ENCRYPTION_KEY")) return "Signed in, but WALLET_ENCRYPTION_KEY is missing or is not 32 bytes of base64.";
  return "Signed in, but your wallet could not be loaded. Check the server logs.";
}

/** Returns the user's wallet address, creating the wallet on first call (first Google login). */
export async function getOrCreateWallet(userId: string) {
  if (!db) throw new Error("DATABASE_URL is not set");
  const [found] = await db.select({ address: wallets.address }).from(wallets).where(eq(wallets.userId, userId));
  if (found) return found.address as Hex;
  const pk = generatePrivateKey();
  const address = privateKeyToAccount(pk).address;
  await db.insert(wallets).values({ userId, address, encryptedKey: encrypt(pk, userId) }).onConflictDoNothing();
  const [row] = await db.select({ address: wallets.address }).from(wallets).where(eq(wallets.userId, userId));
  return row.address as Hex; // concurrent first logins: whichever insert won
}

const TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// One scalar across chains: valid only while every asset is 6 decimals, which selftest asserts.
export const MAX_PLATFORM_PAYMENT = BigInt(process.env.PLATFORM_WALLET_MAX_PER_PAYMENT || "5000000"); // 5 USDT/USDC

/**
 * The client names which chain it is paying on; it never supplies domain fields. The server
 * rebuilds the whole EIP-712 domain from CHAINS, so a caller cannot steer a signature at
 * another chain's token — see signWithKey.
 */
export type AuthRequest = { to: string; value: string; validAfter: string; validBefore: string; nonce: string; network: string };

/**
 * Policy: an allowlisted chain's asset, only to PAY_TO, capped, short-lived. Returns the
 * canonical message plus the resolved network, or an error.
 */
export function checkAuthorization(req: AuthRequest, from: Hex, payTo: string, now = Math.floor(Date.now() / 1000)) {
  try {
    if (!isNetwork(req.network)) return { error: "unsupported network" };
    if (getAddress(req.to) !== getAddress(payTo)) return { error: "can only pay this deployment's PAY_TO_ADDRESS" };
    const value = BigInt(req.value);
    const validAfter = BigInt(req.validAfter);
    const validBefore = BigInt(req.validBefore);
    if (value <= BigInt(0) || value > MAX_PLATFORM_PAYMENT) return { error: `amount must be 1..${MAX_PLATFORM_PAYMENT} base units` };
    if (validBefore <= BigInt(now) || validBefore > BigInt(now + 3600)) return { error: "validBefore must be within the next hour" };
    if (!/^0x[0-9a-fA-F]{64}$/.test(req.nonce)) return { error: "nonce must be bytes32" };
    return { network: req.network, message: { from, to: getAddress(req.to), value, validAfter, validBefore, nonce: req.nonce as Hex } };
  } catch {
    return { error: "malformed authorization" };
  }
}

export async function signAuthorization(userId: string, req: AuthRequest, payTo: string) {
  if (!db) throw new Error("DATABASE_URL is not set");
  const [row] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  if (!row) return { error: "no wallet" };
  const checked = checkAuthorization(req, row.address as Hex, payTo);
  if ("error" in checked) return checked;
  return { signature: await signWithKey(decrypt(row.encryptedKey, userId) as Hex, checked.message, checked.network) };
}

type Message = Extract<ReturnType<typeof checkAuthorization>, { message: unknown }>["message"];

/**
 * EIP-3009 signature over the canonical domain for `network`. Every domain field comes from
 * CHAINS, never from the request, so the client can only pick an allowlisted chain — it can
 * never make us sign a Whitechain USDT authorization for a payment it claimed was on Arc.
 * chainId is part of the domain, so a signature cannot be replayed on the other chain.
 */
export function signWithKey(pk: Hex, message: Message, network: Network) {
  const { asset, chain } = CHAINS[network];
  return privateKeyToAccount(pk).signTypedData({
    domain: { name: asset.extra.name, version: asset.extra.version, chainId: chain.id, verifyingContract: asset.address },
    types: TYPES,
    primaryType: "TransferWithAuthorization",
    message,
  });
}
