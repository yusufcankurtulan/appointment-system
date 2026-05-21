import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { verifyLogin, getAdminSettings } from "./adminStore.js";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      throw new Error("JWT_SECRET veya ADMIN_PASSWORD ortam değişkeni tanımlı olmalı.");
    }
    return "yerel-gelistirme-gizli-anahtar";
  }
  return secret;
}

export function createToken(username: string): string {
  const payload = {
    sub: username,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string): string | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", getSecret()).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as {
      sub: string;
      exp: number;
    };
    if (!payload.sub || payload.exp < Date.now()) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Giriş yapmanız gerekiyor." });
    return;
  }
  const user = verifyToken(header.slice(7));
  if (!user) {
    res.status(401).json({ error: "Oturum süresi doldu. Tekrar giriş yapın." });
    return;
  }
  (req as Request & { user?: string }).user = user;
  next();
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim() || !password) {
    res.status(400).json({ error: "Kullanıcı adı ve şifre gerekli." });
    return;
  }
  const ok = await verifyLogin(username.trim(), password);
  if (!ok) {
    res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
    return;
  }
  const settings = await getAdminSettings();
  res.json({
    token: createToken(settings.username),
    username: settings.username,
    displayName: settings.displayName,
    expiresIn: TOKEN_TTL_MS,
  });
}
