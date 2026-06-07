import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: "email e senha são obrigatórios" });
    }

    try {
      const user = await db.getUserByEmail(email.toLowerCase().trim());
      if (!user || !user.password) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      await db.updateUserLastSignedIn(user.id);

      const token = await sdk.createSessionToken(user.id, user.email ?? email);
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return res.json({ ok: true, name: user.name, email: user.email, role: user.role });
    } catch (err: any) {
      console.error("[Auth] Login failed:", err);
      return res.status(500).json({ error: "Erro interno" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return res.json({ ok: true });
  });
}
