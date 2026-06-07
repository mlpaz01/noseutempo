import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = "admin@noseutempo.app";
const ADMIN_PASSWORD = "Flor2012@";
const ADMIN_NAME = "Admin NoMeuTempo";

async function seed() {
  const db = drizzle(process.env.DATABASE_URL!);

  const existing = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);

  if (existing.length > 0) {
    console.log(`[Seed] Admin already exists: ${ADMIN_EMAIL}`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await db.insert(users).values({
    openId: `admin-${Date.now()}`,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: hash,
    loginMethod: "password",
    role: "admin",
    lastSignedIn: new Date(),
  });

  console.log(`[Seed] Admin criado: ${ADMIN_EMAIL}`);
  process.exit(0);
}

seed().catch(err => {
  console.error("[Seed] Erro:", err);
  process.exit(1);
});
