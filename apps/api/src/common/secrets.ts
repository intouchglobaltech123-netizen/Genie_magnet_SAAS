import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../env.js";

/**
 * Secrets kept in the database (P3-06) — an agency's WhatsApp token, its Razorpay key, social tokens, the raw token of
 * a private link the app sends on — are encrypted with AES-256-GCM. The key is SECRETS_KEY (or one derived from
 * BETTER_AUTH_SECRET while it is not set); the stored text says which version of the format it is.
 */
@Injectable()
export class Secrets {
  private readonly key: Buffer;

  constructor(@Inject(ENV) env: Env) {
    const source = env.SECRETS_KEY ?? env.BETTER_AUTH_SECRET ?? "local-development-secrets-key-not-for-real-use";
    this.key = Buffer.from(hkdfSync("sha256", source, "genie-magnet-os", "secrets-v1", 32));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
  }

  decrypt(stored: string): string {
    const [version, iv, tag, data] = stored.split(":");
    if (version !== "v1" || !iv || !tag || data === undefined) throw new Error("Not an encrypted secret.");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  }

  /** The last few characters, to show which secret is saved without showing it. */
  static hint(plain: string) {
    return plain.length > 8 ? `…${plain.slice(-4)}` : "…";
  }

  /** A stable fingerprint (for comparing without decrypting). */
  static fingerprint(plain: string) {
    return createHash("sha256").update(plain).digest("hex").slice(0, 16);
  }
}
