import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  campaigns,
  creatives,
  metrics,
  integrations,
  dispatchLogs,
  calibrationLogs,
  InsertCampaign,
  InsertCreative,
  InsertMetric,
  InsertIntegration,
  InsertDispatchLog,
  InsertCalibrationLog,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function getCampaigns(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0];
}

export async function createCampaign(data: InsertCampaign) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(campaigns).values(data);
  return result;
}

export async function updateCampaign(id: number, data: Partial<InsertCampaign>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.update(campaigns).set(data).where(eq(campaigns.id, id));
}

export async function deleteCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.update(campaigns).set({ status: "arquivada" }).where(eq(campaigns.id, id));
}

// ─── Creatives ────────────────────────────────────────────────────────────────

export async function getCreatives(userId: number, campaignId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(creatives.userId, userId)];
  if (campaignId !== undefined) conditions.push(eq(creatives.campaignId, campaignId));
  return db.select().from(creatives).where(and(...conditions)).orderBy(desc(creatives.createdAt));
}

export async function getCreativeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(creatives).where(eq(creatives.id, id)).limit(1);
  return result[0];
}

export async function createCreative(data: InsertCreative) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.insert(creatives).values(data);
}

export async function updateCreative(id: number, data: Partial<InsertCreative>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.update(creatives).set(data).where(eq(creatives.id, id));
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export async function getMetrics(campaignId: number, from?: Date, to?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(metrics.campaignId, campaignId)];
  if (from) conditions.push(gte(metrics.date, from));
  if (to) conditions.push(lte(metrics.date, to));
  return db.select().from(metrics).where(and(...conditions)).orderBy(desc(metrics.date));
}

export async function getMetricsByUserId(userId: number, from?: Date, to?: Date) {
  const db = await getDb();
  if (!db) return [];
  const userCampaigns = await getCampaigns(userId);
  if (userCampaigns.length === 0) return [];
  const campaignIds = userCampaigns.map((c) => c.id);
  const conditions = [sql`${metrics.campaignId} IN (${sql.join(campaignIds.map(id => sql`${id}`), sql`, `)})`];
  if (from) conditions.push(gte(metrics.date, from));
  if (to) conditions.push(lte(metrics.date, to));
  return db.select().from(metrics).where(and(...conditions)).orderBy(desc(metrics.date));
}

export async function createMetric(data: InsertMetric) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.insert(metrics).values(data);
}

export async function getDashboardSummary(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const userCampaigns = await getCampaigns(userId);
  const activeCampaigns = userCampaigns.filter((c) => c.status === "ativa");
  const campaignIds = userCampaigns.map((c) => c.id);
  if (campaignIds.length === 0) {
    return { totalImpressions: 0, totalClicks: 0, totalConversions: 0, totalSpend: 0, totalRevenue: 0, avgRoi: 0, activeCampaigns: 0 };
  }
  const allMetrics = await db
    .select()
    .from(metrics)
    .where(sql`${metrics.campaignId} IN (${sql.join(campaignIds.map(id => sql`${id}`), sql`, `)})`);
  const totals = allMetrics.reduce(
    (acc, m) => ({
      totalImpressions: acc.totalImpressions + (m.impressions ?? 0),
      totalClicks: acc.totalClicks + (m.clicks ?? 0),
      totalConversions: acc.totalConversions + (m.conversions ?? 0),
      totalSpend: acc.totalSpend + parseFloat(String(m.spend ?? 0)),
      totalRevenue: acc.totalRevenue + parseFloat(String(m.revenue ?? 0)),
      roiSum: acc.roiSum + parseFloat(String(m.roi ?? 0)),
      count: acc.count + 1,
    }),
    { totalImpressions: 0, totalClicks: 0, totalConversions: 0, totalSpend: 0, totalRevenue: 0, roiSum: 0, count: 0 }
  );
  return {
    ...totals,
    avgRoi: totals.count > 0 ? totals.roiSum / totals.count : 0,
    activeCampaigns: activeCampaigns.length,
  };
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export async function getIntegrations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(integrations).where(eq(integrations.userId, userId));
}

export async function upsertIntegration(data: InsertIntegration) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, data.userId), eq(integrations.channel, data.channel)))
    .limit(1);
  if (existing.length > 0) {
    return db.update(integrations).set(data).where(eq(integrations.id, existing[0].id));
  }
  return db.insert(integrations).values(data);
}

// ─── Dispatch Logs ────────────────────────────────────────────────────────────

export async function getDispatchLogs(campaignId?: number, channel?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (campaignId !== undefined) conditions.push(eq(dispatchLogs.campaignId, campaignId));
  if (channel) conditions.push(eq(dispatchLogs.channel, channel));
  return db
    .select()
    .from(dispatchLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dispatchLogs.createdAt))
    .limit(100);
}

export async function createDispatchLog(data: InsertDispatchLog) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.insert(dispatchLogs).values(data);
}

export async function updateDispatchLog(id: number, data: Partial<InsertDispatchLog>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.update(dispatchLogs).set(data).where(eq(dispatchLogs.id, id));
}

// ─── Calibration Logs ─────────────────────────────────────────────────────────

export async function getCalibrationLogs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calibrationLogs)
    .where(eq(calibrationLogs.userId, userId))
    .orderBy(desc(calibrationLogs.createdAt));
}

export async function getCalibrationLogsByCampaign(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calibrationLogs)
    .where(eq(calibrationLogs.campaignId, campaignId))
    .orderBy(desc(calibrationLogs.createdAt));
}

export async function createCalibrationLog(data: InsertCalibrationLog) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.insert(calibrationLogs).values(data);
}

export async function updateCalibrationLog(id: number, data: Partial<InsertCalibrationLog>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.update(calibrationLogs).set(data).where(eq(calibrationLogs.id, id));
}
