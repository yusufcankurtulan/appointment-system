import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { verifyLogin, getAdminSettings } from "./adminStore.js";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD;

  if (!secret) {
    console.error("[AUTH] Secret bulunamadı");

    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      throw new Error("JWT_SECRET veya ADMIN_PASSWORD ortam değişkeni tanımlı olmalı.");
    }

    return "yerel-gelistirme-gizli-anahtar";
  }

  return secret;
}

export function createToken(username: string): string {
  console.log(`[AUTH] Token oluşturuluyor -> ${username}`);

  const payload = {
    sub: username,
    exp: Date.now() + TOKEN_TTL_MS,
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const sig = createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");

  return `${body}.${sig}`;
}

export function verifyToken(token: string): string | null {
  try {
    console.log("[AUTH] Token doğrulama başladı");

    const [body, sig] = token.split(".");

    if (!body || !sig) {
      console.warn("[AUTH] Token formatı geçersiz");
      return null;
    }

    const expected = createHmac("sha256", getSecret())
      .update(body)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);

    if (
      sigBuf.length !== expBuf.length ||
      !timingSafeEqual(sigBuf, expBuf)
    ) {
      console.warn("[AUTH] Token imzası eşleşmedi");
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8")
    ) as {
      sub: string;
      exp: number;
    };

    if (!payload.sub) {
      console.warn("[AUTH] Token içinde kullanıcı yok");
      return null;
    }

    if (payload.exp < Date.now()) {
      console.warn("[AUTH] Token süresi dolmuş");
      return null;
    }

    console.log(`[AUTH] Token doğrulandı -> ${payload.sub}`);

    return payload.sub;
  } catch (err) {
    console.error("[AUTH] Token doğrulama hatası:", err);
    return null;
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.log("[AUTH] Protected route erişim isteği");

  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    console.warn("[AUTH] Authorization header eksik");

    res.status(401).json({
      error: "Giriş yapmanız gerekiyor.",
    });

    return;
  }

  const user = verifyToken(header.slice(7));

  if (!user) {
    console.warn("[AUTH] Kullanıcı doğrulanamadı");

    res.status(401).json({
      error: "Oturum süresi doldu. Tekrar giriş yapın.",
    });

    return;
  }

  console.log(`[AUTH] Yetkili erişim -> ${user}`);

  (req as Request & { user?: string }).user = user;

  next();
}

export async function loginHandler(
  req: Request,
  res: Response
): Promise<void> {
  console.log("[LOGIN] Yeni giriş isteği geldi");

  const {
    username,
    password,
  } = req.body as {
    username?: string;
    password?: string;
  };

  console.log("[LOGIN] Username:", username);

  if (!username?.trim() || !password) {
    console.warn("[LOGIN] Eksik kullanıcı adı veya şifre");

    res.status(400).json({
      error: "Kullanıcı adı ve şifre gerekli.",
    });

    return;
  }

  const ok = await verifyLogin(username.trim(), password);

  if (!ok) {
    console.warn(`[LOGIN] Başarısız giriş denemesi -> ${username}`);

    res.status(401).json({
      error: "Kullanıcı adı veya şifre hatalı.",
    });

    return;
  }

  console.log(`[LOGIN] Başarılı giriş -> ${username}`);

  const settings = await getAdminSettings();

  res.json({
    token: createToken(settings.username),
    username: settings.username,
    displayName: settings.displayName,
    expiresIn: TOKEN_TTL_MS,
  });
}