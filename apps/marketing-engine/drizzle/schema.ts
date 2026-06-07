import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  password: varchar("password", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  objective: varchar("objective", { length: 128 }).notNull(),
  targetAudience: text("targetAudience"),
  budgetTotal: decimal("budgetTotal", { precision: 12, scale: 2 }).notNull(),
  budgetSpent: decimal("budgetSpent", { precision: 12, scale: 2 }).default("0"),
  channels: json("channels").$type<string[]>().notNull(),
  status: mysqlEnum("status", ["rascunho", "ativa", "pausada", "concluida", "arquivada"])
    .default("rascunho")
    .notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Creatives ────────────────────────────────────────────────────────────────

export const creatives = mysqlTable("creatives", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId"),
  userId: int("userId").notNull(),
  briefing: text("briefing").notNull(),
  imageUrl: text("imageUrl"),
  imageKey: text("imageKey"),
  status: mysqlEnum("status", ["gerando", "aprovado", "rejeitado", "em_uso"])
    .default("gerando")
    .notNull(),
  channels: json("channels").$type<string[]>(),
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Creative = typeof creatives.$inferSelect;
export type InsertCreative = typeof creatives.$inferInsert;

// ─── Metrics ──────────────────────────────────────────────────────────────────

export const metrics = mysqlTable("metrics", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  channel: varchar("channel", { length: 64 }).notNull(),
  date: timestamp("date").notNull(),
  impressions: int("impressions").default(0),
  clicks: int("clicks").default(0),
  conversions: int("conversions").default(0),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
  roi: decimal("roi", { precision: 8, scale: 4 }).default("0"),
  ctr: decimal("ctr", { precision: 8, scale: 4 }).default("0"),
  cpc: decimal("cpc", { precision: 8, scale: 4 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = typeof metrics.$inferInsert;

// ─── Integrations ─────────────────────────────────────────────────────────────

export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  channel: mysqlEnum("channel", ["linkedin", "tiktok", "instagram", "google"]).notNull(),
  accountName: varchar("accountName", { length: 255 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  status: mysqlEnum("status", ["conectado", "desconectado", "erro"]).default("desconectado").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;

// ─── Dispatch Logs ────────────────────────────────────────────────────────────

export const dispatchLogs = mysqlTable("dispatch_logs", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  creativeId: int("creativeId"),
  channel: varchar("channel", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["agendado", "enviado", "falhou", "cancelado"])
    .default("agendado")
    .notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  executedAt: timestamp("executedAt"),
  errorMessage: text("errorMessage"),
  externalId: varchar("externalId", { length: 255 }),
  payload: json("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DispatchLog = typeof dispatchLogs.$inferSelect;
export type InsertDispatchLog = typeof dispatchLogs.$inferInsert;

// ─── Calibration Logs ─────────────────────────────────────────────────────────

export const calibrationLogs = mysqlTable("calibration_logs", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  userId: int("userId").notNull(),
  analysis: text("analysis").notNull(),
  suggestions: json("suggestions").$type<CalibrationSuggestion[]>().notNull(),
  status: mysqlEnum("status", ["pendente", "aplicado", "ignorado"]).default("pendente").notNull(),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CalibrationLog = typeof calibrationLogs.$inferSelect;
export type InsertCalibrationLog = typeof calibrationLogs.$inferInsert;

export type CalibrationSuggestion = {
  tipo: "orcamento" | "publico_alvo" | "criativo" | "canal";
  descricao: string;
  valorAtual?: string;
  valorSugerido?: string;
  impactoEstimado?: string;
};
