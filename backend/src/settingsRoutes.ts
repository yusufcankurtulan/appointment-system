import type { Request, Response } from "express";
import {
  getAdminSettings,
  saveAdminSettings,
  settingsToPublic,
  updatePassword,
  verifyLogin,
} from "./adminStore.js";
import { createToken } from "./auth.js";

interface SettingsUpdateBody {
  currentPassword?: string;
  username?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
  email?: string;
  displayName?: string;
  defaultWorkStart?: string;
  defaultWorkEnd?: string;
  defaultWorkDays?: string;
  defaultSlotDuration?: number;
}

export async function getSettingsHandler(_req: Request, res: Response): Promise<void> {
  const settings = await getAdminSettings();
  res.json(settingsToPublic(settings));
}

export async function updateSettingsHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as SettingsUpdateBody;
  const currentPassword = body.currentPassword?.trim();

  if (!currentPassword) {
    res.status(400).json({ error: "Değişiklik için mevcut şifrenizi girin." });
    return;
  }

  const settings = await getAdminSettings();
  const tokenUser = (req as Request & { user?: string }).user;

  if (tokenUser !== settings.username) {
    res.status(401).json({ error: "Oturum geçersiz." });
    return;
  }

  const valid = await verifyLogin(settings.username, currentPassword);
  if (!valid) {
    res.status(401).json({ error: "Mevcut şifre hatalı." });
    return;
  }

  if (body.username?.trim()) {
    const next = body.username.trim();
    if (next.length < 3) {
      res.status(400).json({ error: "Kullanıcı adı en az 3 karakter olmalı." });
      return;
    }
    settings.username = next;
  }

  if (body.newPassword) {
    if (body.newPassword.length < 6) {
      res.status(400).json({ error: "Yeni şifre en az 6 karakter olmalı." });
      return;
    }
    if (body.newPassword !== body.newPasswordConfirm) {
      res.status(400).json({ error: "Yeni şifreler eşleşmiyor." });
      return;
    }
    await updatePassword(settings, body.newPassword);
  }

  if (body.email !== undefined) settings.email = body.email.trim();
  if (body.displayName?.trim()) settings.displayName = body.displayName.trim();
  if (body.defaultWorkStart?.trim()) settings.defaultWorkStart = body.defaultWorkStart.trim();
  if (body.defaultWorkEnd?.trim()) settings.defaultWorkEnd = body.defaultWorkEnd.trim();
  if (body.defaultWorkDays?.trim()) settings.defaultWorkDays = body.defaultWorkDays.trim();
  if (body.defaultSlotDuration) {
    const d = Number(body.defaultSlotDuration);
    if ([15, 30, 45, 60].includes(d)) settings.defaultSlotDuration = d;
  }

  await saveAdminSettings(settings);

  const newToken = createToken(settings.username);
  res.json({
    ...settingsToPublic(settings),
    token: newToken,
    message: "Ayarlar kaydedildi.",
  });
}
