import { z } from "zod";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { sdk } from "./_core/sdk";
import bcrypt from "bcryptjs";
import {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCreatives,
  getCreativeById,
  createCreative,
  updateCreative,
  getMetrics,
  getMetricsByUserId,
  createMetric,
  getDashboardSummary,
  getIntegrations,
  upsertIntegration,
  getDispatchLogs,
  createDispatchLog,
  updateDispatchLog,
  getCalibrationLogs,
  getCalibrationLogsByCampaign,
  createCalibrationLog,
  updateCalibrationLog,
  getDb,
  getUserByEmail,
} from "./db";
import { analyzeAndCalibrate } from "./openrouter";
import { campaigns } from "../drizzle/schema";

// ─── Campaigns Router ─────────────────────────────────────────────────────────

const campaignsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getCampaigns(ctx.user.id)),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getCampaignById(input.id)),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        objective: z.string().min(1),
        targetAudience: z.string().optional(),
        budgetTotal: z.string(),
        channels: z.array(z.enum(["linkedin", "tiktok", "instagram", "google"])),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await createCampaign({
        userId: ctx.user.id,
        name: input.name,
        objective: input.objective,
        targetAudience: input.targetAudience,
        budgetTotal: input.budgetTotal,
        channels: input.channels,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        status: "rascunho",
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        objective: z.string().optional(),
        targetAudience: z.string().optional(),
        budgetTotal: z.string().optional(),
        channels: z.array(z.enum(["linkedin", "tiktok", "instagram", "google"])).optional(),
        status: z.enum(["rascunho", "ativa", "pausada", "concluida", "arquivada"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, startDate, endDate, ...rest } = input;
      await updateCampaign(id, {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCampaign(input.id);
      return { success: true };
    }),

  // Schedule automatic dispatch via node-cron
  scheduleDispatch: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        cron: z.string(), // 6-field: "0 0 9 * * *"
      })
    )
    .mutation(async ({ input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new Error("Campanha não encontrada");

      const { runScheduledDispatch } = await import("./_core/index");

      if (campaign.scheduleCronTaskUid) {
        await updateHeartbeatJob(campaign.scheduleCronTaskUid, { cron: input.cron, enable: true });
      } else {
        const job = await createHeartbeatJob(
          {
            name: `dispatch-campaign-${input.campaignId}`,
            cron: input.cron,
            path: "/api/scheduled/dispatch",
            description: `Disparo automático: ${campaign.name}`,
          },
          runScheduledDispatch
        );
        const db = await getDb();
        if (db) {
          await db
            .update(campaigns)
            .set({ scheduleCronTaskUid: job.taskUid })
            .where(eq(campaigns.id, input.campaignId));
        }
      }
      return { success: true };
    }),

  pauseDispatch: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign?.scheduleCronTaskUid) throw new Error("Nenhum agendamento ativo");
      await updateHeartbeatJob(campaign.scheduleCronTaskUid, { enable: false });
      return { success: true };
    }),
});

// ─── Creatives Router ─────────────────────────────────────────────────────────

const creativesRouter = router({
  list: protectedProcedure
    .input(z.object({ campaignId: z.number().optional() }))
    .query(({ ctx, input }) => getCreatives(ctx.user.id, input.campaignId)),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getCreativeById(input.id)),

  // Adiciona criativo via URL externa (ex: imagem exportada do ChatGPT)
  addFromUrl: protectedProcedure
    .input(
      z.object({
        briefing: z.string().min(3),
        imageUrl: z.string().url("URL inválida"),
        campaignId: z.number().optional(),
        channels: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const insertResult = await createCreative({
        userId: ctx.user.id,
        campaignId: input.campaignId,
        briefing: input.briefing,
        imageUrl: input.imageUrl,
        channels: input.channels,
        status: "aprovado",
      });

      const insertId = (insertResult as any).insertId as number;
      return { success: true, id: insertId, imageUrl: input.imageUrl };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["aprovado", "rejeitado", "em_uso"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateCreative(input.id, { status: input.status });
      return { success: true };
    }),

  linkToCampaign: protectedProcedure
    .input(z.object({ id: z.number(), campaignId: z.number() }))
    .mutation(async ({ input }) => {
      await updateCreative(input.id, { campaignId: input.campaignId, status: "em_uso" });
      return { success: true };
    }),
});

// ─── Metrics Router ───────────────────────────────────────────────────────────

const metricsRouter = router({
  byCampaign: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(({ input }) =>
      getMetrics(
        input.campaignId,
        input.from ? new Date(input.from) : undefined,
        input.to ? new Date(input.to) : undefined
      )
    ),

  all: protectedProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }))
    .query(({ ctx, input }) =>
      getMetricsByUserId(
        ctx.user.id,
        input.from ? new Date(input.from) : undefined,
        input.to ? new Date(input.to) : undefined
      )
    ),

  dashboard: protectedProcedure.query(({ ctx }) => getDashboardSummary(ctx.user.id)),

  seed: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        channel: z.string(),
        impressions: z.number(),
        clicks: z.number(),
        conversions: z.number(),
        spend: z.string(),
        revenue: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const spend = parseFloat(input.spend);
      const revenue = parseFloat(input.revenue);
      const roi = spend > 0 ? (revenue - spend) / spend : 0;
      const ctr = input.impressions > 0 ? input.clicks / input.impressions : 0;
      const cpc = input.clicks > 0 ? spend / input.clicks : 0;
      await createMetric({
        campaignId: input.campaignId,
        channel: input.channel,
        date: new Date(),
        impressions: input.impressions,
        clicks: input.clicks,
        conversions: input.conversions,
        spend: input.spend,
        revenue: input.revenue,
        roi: roi.toFixed(4),
        ctr: ctr.toFixed(4),
        cpc: cpc.toFixed(4),
      });
      return { success: true };
    }),
});

// ─── Integrations Router ──────────────────────────────────────────────────────

const integrationsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getIntegrations(ctx.user.id)),

  save: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["linkedin", "tiktok", "instagram", "google"]),
        accountName: z.string().optional(),
        accessToken: z.string().optional(),
        refreshToken: z.string().optional(),
        status: z.enum(["conectado", "desconectado", "erro"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertIntegration({
        userId: ctx.user.id,
        channel: input.channel,
        accountName: input.accountName,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        status: input.status ?? "desconectado",
      });
      return { success: true };
    }),
});

// ─── Dispatch Router ──────────────────────────────────────────────────────────

const dispatchRouter = router({
  logs: protectedProcedure
    .input(z.object({ campaignId: z.number().optional(), channel: z.string().optional() }))
    .query(({ input }) => getDispatchLogs(input.campaignId, input.channel)),

  schedule: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        creativeId: z.number().optional(),
        channel: z.string(),
        scheduledAt: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await createDispatchLog({
        campaignId: input.campaignId,
        creativeId: input.creativeId,
        channel: input.channel,
        scheduledAt: new Date(input.scheduledAt),
        status: "agendado",
      });
      return { success: true };
    }),
});

// ─── Calibration Router ───────────────────────────────────────────────────────

const calibrationRouter = router({
  list: protectedProcedure.query(({ ctx }) => getCalibrationLogs(ctx.user.id)),

  byCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(({ input }) => getCalibrationLogsByCampaign(input.campaignId)),

  analyze: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new Error("Campanha não encontrada");

      const metricsData = await getMetrics(input.campaignId);
      const totalImpressions = metricsData.reduce((s, m) => s + (m.impressions ?? 0), 0);
      const totalClicks = metricsData.reduce((s, m) => s + (m.clicks ?? 0), 0);
      const totalConversions = metricsData.reduce((s, m) => s + (m.conversions ?? 0), 0);
      const totalSpend = metricsData.reduce((s, m) => s + parseFloat(String(m.spend ?? 0)), 0);
      const totalRevenue = metricsData.reduce((s, m) => s + parseFloat(String(m.revenue ?? 0)), 0);
      const avgRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      // Use OpenRouter (Claude) for intelligent analysis
      const result = await analyzeAndCalibrate({
        campaignName: campaign.name,
        objective: campaign.objective,
        budget: parseFloat(String(campaign.budgetTotal)),
        channels: campaign.channels as string[],
        metrics: {
          impressions: totalImpressions,
          clicks: totalClicks,
          conversions: totalConversions,
          spend: totalSpend,
          revenue: totalRevenue,
          ctr,
          roi: avgRoi,
        },
      });

      await createCalibrationLog({
        campaignId: input.campaignId,
        userId: ctx.user.id,
        analysis: result.analysis,
        suggestions: result.suggestions,
        status: "pendente",
      });

      return { success: true, analysis: result.analysis, suggestions: result.suggestions };
    }),

  // Renamed from 'apply' to 'markApplied' to avoid tRPC reserved word conflict
  markApplied: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateCalibrationLog(input.id, { status: "aplicado", appliedAt: new Date() });
      return { success: true };
    }),

  ignore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateCalibrationLog(input.id, { status: "ignorado" });
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user || !user.password) {
          throw new Error("Credenciais inválidas");
        }
        const valid = await bcrypt.compare(input.password, user.password);
        if (!valid) throw new Error("Credenciais inválidas");

        const token = await sdk.createSessionToken(user.id, user.email ?? input.email);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { ok: true, name: user.name, email: user.email, role: user.role };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  campaigns: campaignsRouter,
  creatives: creativesRouter,
  metrics: metricsRouter,
  integrations: integrationsRouter,
  dispatch: dispatchRouter,
  calibration: calibrationRouter,
});

export type AppRouter = typeof appRouter;
