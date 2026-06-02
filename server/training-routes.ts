import { Router, Request, Response } from "express";
import { db, pool } from "./db";
import { trainingModules, trainingProgress, users } from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { z } from "zod";

const updateProgressSchema = z.object({
  progressPercent: z.number().min(0).max(100).optional(),
});

const completeModuleSchema = z.object({
  quizScore: z.number().min(0).max(100).optional(),
});

const router = Router();

// --- Lightweight schema bootstrap for category/subcategory/video tree ---
let ensureContentPromise: Promise<void> | null = null;
async function ensureTrainingContent() {
  if (ensureContentPromise) return ensureContentPromise;
  ensureContentPromise = (async () => {
    // Tables for categories, subcategories, and videos
    await pool.query(`
      create table if not exists training_categories (
        id uuid primary key default gen_random_uuid(),
        title text not null unique,
        status text not null default 'Active',
        thumbnail_url text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table if not exists training_subcategories (
        id uuid primary key default gen_random_uuid(),
        category_id uuid not null references training_categories(id) on delete cascade,
        title text not null,
        status text not null default 'Active',
        thumbnail_url text,
        published_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique(category_id, title)
      );
      create table if not exists training_videos (
        id uuid primary key default gen_random_uuid(),
        subcategory_id uuid not null references training_subcategories(id) on delete cascade,
        title text not null,
        description text,
        video_url text not null,
        status text not null default 'Active',
        duration_seconds integer,
        order_index integer default 0,
        published_at timestamptz default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists idx_training_subcategories_category on training_subcategories(category_id);
      create index if not exists idx_training_videos_subcategory on training_videos(subcategory_id);
    `);

    // Seed demo data only if empty
    console.log("🔍 Checking training categories count...");
    const { rows } = await pool.query<{ count: string }>(
      "select count(*)::text as count from training_categories",
    );
    console.log(`📊 Training categories count: ${rows[0]?.count}`);
    if (rows[0]?.count !== "0") return;

    console.log("🌱 Seeding training content...");
    const seed = [
      {
        title: "Test 2",
        status: "Active",
        thumbnailUrl: "https://i.imgur.com/l0Y1y3A.png",
        publishedAt: "2025-12-10",
        subs: [
          {
            title: "Alibaba Traning Video",
            status: "Active",
            thumbnailUrl: "https://i.imgur.com/6g11w0N.png",
            publishedAt: "2025-12-10",
            videos: [
              {
                title: "Alibaba intro",
                description: "Getting started with Alibaba portal.",
                videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
                durationSeconds: 60,
              },
            ],
          },
        ],
      },
      {
        title: "Test Main",
        status: "Active",
        thumbnailUrl: "https://i.imgur.com/Ncq9D0n.png",
        publishedAt: "2025-12-05",
        subs: [
          {
            title: "test 2",
            status: "Active",
            thumbnailUrl: "https://i.imgur.com/ctFoF5D.png",
            publishedAt: "2025-12-05",
            videos: [
              {
                title: "Sales pitch basics",
                description: "Core points for client calls.",
                videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                durationSeconds: 120,
              },
              {
                title: "Handling objections",
                description: "Quick wins for common objections.",
                videoUrl: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
                durationSeconds: 90,
              },
            ],
          },
          {
            title: "Test",
            status: "Active",
            thumbnailUrl: "https://i.imgur.com/ctFoF5D.png",
            publishedAt: "2025-12-05",
            videos: [
              {
                title: "Closer tips",
                description: "How to close faster.",
                videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
                durationSeconds: 75,
              },
            ],
          },
        ],
      },
    ] as const;

    for (const cat of seed) {
      const catResult = await pool.query<{ id: string }>(
        `
        insert into training_categories (title, status, thumbnail_url, created_at, updated_at)
        values ($1, $2, $3, $4::timestamptz, $4::timestamptz)
        on conflict (title) do update set updated_at = excluded.updated_at
        returning id
        `,
        [cat.title, cat.status, cat.thumbnailUrl, cat.publishedAt],
      );
      const categoryId = catResult.rows[0]?.id;
      if (!categoryId) continue;

      for (const sub of cat.subs) {
        const subResult = await pool.query<{ id: string }>(
          `
          insert into training_subcategories (category_id, title, status, thumbnail_url, published_at, created_at, updated_at)
          values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz, $5::timestamptz)
          on conflict (category_id, title) do update set updated_at = excluded.updated_at
          returning id
          `,
          [categoryId, sub.title, sub.status, sub.thumbnailUrl, sub.publishedAt],
        );
        const subId = subResult.rows[0]?.id;
        if (!subId) continue;

        let orderIndex = 0;
        for (const vid of sub.videos) {
          await pool.query(
            `
            insert into training_videos (subcategory_id, title, description, video_url, status, duration_seconds, order_index, published_at)
            values ($1, $2, $3, $4, $5, $6, $7, now())
            on conflict do nothing
            `,
            [
              subId,
              vid.title,
              vid.description,
              vid.videoUrl,
              "Active",
              vid.durationSeconds ?? null,
              orderIndex++,
            ],
          );
        }
      }
    }
  })();
  return ensureContentPromise;
}

// Ensure schema is present before any handler runs
router.use(async (_req, _res, next) => {
  try {
    await ensureTrainingContent();
  } catch (err) {
    console.error("Failed to ensure training content schema/seed", err);
  }
  return next();
});

router.use((req: Request, res: Response, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return next();
});

type TrainingCategory = "DRM" | "SEO" | "Alibaba" | "SalesTools";

interface ModuleWithProgress {
  id: string;
  title: string;
  description: string | null;
  category: TrainingCategory;
  contentType: "video" | "document" | "link";
  contentUrl: string;
  thumbnailUrl: string | null;
  estimatedMinutes: number | null;
  orderIndex: number | null;
  quizJson: string | null;
  department: string | null;
  isActive: number | null;
  isCompleted: boolean;
  progressPercent: number;
  quizScore: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface CategoryProgress {
  category: TrainingCategory;
  displayName: string;
  totalModules: number;
  completedModules: number;
  progressPercent: number;
  modules: ModuleWithProgress[];
}

const categoryDisplayNames: Record<TrainingCategory, string> = {
  DRM: "DRM Training",
  SEO: "SEO Training",
  Alibaba: "Alibaba Portal Training",
  SalesTools: "Sales Scripts, Tools & Methods",
};

// --- Category/Subcategory tree for the Training Video page ---
router.get("/tree", async (_req: Request, res: Response) => {
  try {
    const { rows: categories } = await pool.query<{
      id: string;
      title: string;
      status: string;
      thumbnail_url: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      select id, title, status, thumbnail_url, created_at, updated_at
      from training_categories
      order by created_at asc, title asc
      `,
    );

    const { rows: subs } = await pool.query<{
      id: string;
      category_id: string;
      title: string;
      status: string;
      thumbnail_url: string | null;
      published_at: string | null;
      created_at: string;
    }>(
      `
      select id, category_id, title, status, thumbnail_url, published_at, created_at
      from training_subcategories
      order by created_at asc, title asc
      `,
    );

    const { rows: videos } = await pool.query<{
      id: string;
      subcategory_id: string;
      status: string;
    }>(
      `
      select id, subcategory_id, status
      from training_videos
      `,
    );

    const videoCountBySub = videos.reduce<Record<string, number>>((acc, v) => {
      acc[v.subcategory_id] = (acc[v.subcategory_id] || 0) + (v.status === "Active" ? 1 : 0);
      return acc;
    }, {});

    const tree = categories.map((cat) => {
      const subcats = subs
        .filter((s) => s.category_id === cat.id)
        .map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          thumbnailUrl: s.thumbnail_url,
          date: s.published_at || s.created_at,
          videoCount: videoCountBySub[s.id] || 0,
        }));

      return {
        id: cat.id,
        title: cat.title,
        status: cat.status,
        thumbnailUrl: cat.thumbnail_url,
        date: cat.created_at,
        subcategoryCount: subcats.length,
        subcategories: subcats,
      };
    });

    res.json({ categories: tree });
  } catch (error) {
    console.error("Error fetching training tree:", error);
    res.status(500).json({ error: "Failed to fetch training tree" });
  }
});

// Videos for a given subcategory
router.get("/subcategories/:subId/videos", async (req: Request, res: Response) => {
  try {
    const { subId } = req.params;
    const { rows } = await pool.query<{
      id: string;
      title: string;
      description: string | null;
      video_url: string;
      status: string;
      duration_seconds: number | null;
      order_index: number | null;
      published_at: string | null;
    }>(
      `
      select id, title, description, video_url, status, duration_seconds, order_index, published_at
      from training_videos
      where subcategory_id = $1 and status = 'Active'
      order by coalesce(order_index, 0) asc, published_at desc
      `,
      [subId],
    );

    const videos = rows.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      videoUrl: v.video_url,
      durationSeconds: v.duration_seconds,
      publishedAt: v.published_at,
    }));

    res.json({ videos });
  } catch (error) {
    console.error("Error fetching subcategory videos:", error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

router.get("/modules", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { category, completed, department } = req.query;

    const allModules = await db
      .select({
        id: trainingModules.id,
        title: trainingModules.title,
        description: trainingModules.description,
        category: trainingModules.category,
        contentType: sql<"video" | "document" | "link">`'video'`,
        contentUrl: trainingModules.contentUrl,
        thumbnailUrl: sql<string | null>`null`,
        estimatedMinutes: sql<number | null>`null`,
        orderIndex: sql<number | null>`null`,
        quizJson: sql<string | null>`null`,
        department: sql<string | null>`null`,
        isActive: sql<number | null>`1`,
      })
      .from(trainingModules)
      .where(sql`coalesce(training_modules.is_deleted, false) = false`)
      .orderBy(asc(trainingModules.category), asc(trainingModules.title));

    let filteredModules = allModules;
    if (category && category !== "all") {
      filteredModules = filteredModules.filter(m => m.category === category);
    }
    if (department && department !== "all") {
      filteredModules = filteredModules.filter(m => !m.department || m.department === department);
    }

    const userProgress = await db
      .select()
      .from(trainingProgress)
      .where(eq(trainingProgress.userId, userId));

    const progressMap = new Map(userProgress.map(p => [p.moduleId, p]));

    const modulesWithProgress: ModuleWithProgress[] = filteredModules.map(module => {
      const progress = progressMap.get(module.id);
      return {
        ...module,
        isCompleted: progress?.isCompleted === 1,
        progressPercent: progress?.progressPercent || 0,
        quizScore: progress?.quizScore || null,
        startedAt: progress?.startedAt || null,
        completedAt: progress?.completedAt || null,
      };
    });

    if (completed === "true") {
      return res.json(modulesWithProgress.filter(m => m.isCompleted));
    } else if (completed === "false") {
      return res.json(modulesWithProgress.filter(m => !m.isCompleted));
    }

    res.json(modulesWithProgress);
  } catch (error) {
    console.error("Error fetching training modules:", error);
    res.status(500).json({ error: "Failed to fetch training modules" });
  }
});

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const allModules = await db
      .select({
        id: trainingModules.id,
        title: trainingModules.title,
        description: trainingModules.description,
        category: trainingModules.category,
        contentType: sql<"video" | "document" | "link">`'video'`,
        contentUrl: trainingModules.contentUrl,
        thumbnailUrl: sql<string | null>`null`,
        estimatedMinutes: sql<number | null>`null`,
        orderIndex: sql<number | null>`null`,
        quizJson: sql<string | null>`null`,
        department: sql<string | null>`null`,
        isActive: sql<number | null>`1`,
      })
      .from(trainingModules)
      .where(sql`coalesce(training_modules.is_deleted, false) = false`)
      .orderBy(asc(trainingModules.title));

    const userProgress = await db
      .select()
      .from(trainingProgress)
      .where(eq(trainingProgress.userId, userId));

    const progressMap = new Map(userProgress.map(p => [p.moduleId, p]));

    const categories: TrainingCategory[] = ["DRM", "SEO", "Alibaba", "SalesTools"];
    
    const categoryProgress: CategoryProgress[] = categories.map(category => {
      const categoryModules = allModules.filter(m => m.category === category);
      const modulesWithProgress: ModuleWithProgress[] = categoryModules.map(module => {
        const progress = progressMap.get(module.id);
        return {
          ...module,
          isCompleted: progress?.isCompleted === 1,
          progressPercent: progress?.progressPercent || 0,
          quizScore: progress?.quizScore || null,
          startedAt: progress?.startedAt || null,
          completedAt: progress?.completedAt || null,
        };
      });

      const completedCount = modulesWithProgress.filter(m => m.isCompleted).length;
      const totalCount = modulesWithProgress.length;
      
      return {
        category,
        displayName: categoryDisplayNames[category],
        totalModules: totalCount,
        completedModules: completedCount,
        progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        modules: modulesWithProgress,
      };
    });

    res.json(categoryProgress);
  } catch (error) {
    console.error("Error fetching training categories:", error);
    res.status(500).json({ error: "Failed to fetch training categories" });
  }
});

router.get("/progress/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const allModules = await db
      .select({
        id: trainingModules.id,
        title: trainingModules.title,
        description: trainingModules.description,
        category: trainingModules.category,
        contentType: sql<"video" | "document" | "link">`'video'`,
        contentUrl: trainingModules.contentUrl,
        thumbnailUrl: sql<string | null>`null`,
        estimatedMinutes: sql<number | null>`null`,
        orderIndex: sql<number | null>`null`,
        quizJson: sql<string | null>`null`,
        department: sql<string | null>`null`,
        isActive: sql<number | null>`1`,
      })
      .from(trainingModules)
      .where(sql`coalesce(training_modules.is_deleted, false) = false`);

    const userProgress = await db
      .select()
      .from(trainingProgress)
      .where(eq(trainingProgress.userId, userId));

    const progressMap = new Map(userProgress.map(p => [p.moduleId, p]));

    const totalModules = allModules.length;
    const completedModules = userProgress.filter(p => p.isCompleted === 1).length;
    const inProgressModules = userProgress.filter(p => p.isCompleted === 0 && (p.progressPercent ?? 0) > 0).length;
    const notStartedModules = totalModules - completedModules - inProgressModules;

    const categories: TrainingCategory[] = ["DRM", "SEO", "Alibaba", "SalesTools"];
    const categoryBreakdown = categories.map(category => {
      const categoryModules = allModules.filter(m => m.category === category);
      const completed = categoryModules.filter(m => progressMap.get(m.id)?.isCompleted === 1).length;
      return {
        category,
        displayName: categoryDisplayNames[category],
        total: categoryModules.length,
        completed,
        progressPercent: categoryModules.length > 0 ? Math.round((completed / categoryModules.length) * 100) : 0,
      };
    });

    const overallPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

    res.json({
      userId,
      summary: {
        totalModules,
        completedModules,
        inProgressModules,
        notStartedModules,
        overallPercent,
      },
      categoryBreakdown,
      recentActivity: userProgress
        .filter(p => p.updatedAt)
        .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
        .slice(0, 5)
        .map(p => ({
          moduleId: p.moduleId,
          isCompleted: p.isCompleted === 1,
          progressPercent: p.progressPercent,
          quizScore: p.quizScore,
          updatedAt: p.updatedAt,
        })),
    });
  } catch (error) {
    console.error("Error fetching user progress:", error);
    res.status(500).json({ error: "Failed to fetch user progress" });
  }
});

router.post("/progress/:moduleId/start", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { moduleId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const existing = await db
      .select()
      .from(trainingProgress)
      .where(and(eq(trainingProgress.userId, userId), eq(trainingProgress.moduleId, moduleId)));

    if (existing.length > 0) {
      return res.json({ success: true, message: "Progress already exists", progress: existing[0] });
    }

    const [newProgress] = await db
      .insert(trainingProgress)
      .values({
        userId,
        moduleId,
        isCompleted: 0,
        progressPercent: 0,
        startedAt: new Date(),
      })
      .returning();

    res.json({ success: true, message: "Module started", progress: newProgress });
  } catch (error) {
    console.error("Error starting module:", error);
    res.status(500).json({ error: "Failed to start module" });
  }
});

router.post("/progress/:moduleId/update", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { moduleId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const parseResult = updateProgressSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request body", details: parseResult.error.errors });
    }
    const { progressPercent } = parseResult.data;

    const existing = await db
      .select()
      .from(trainingProgress)
      .where(and(eq(trainingProgress.userId, userId), eq(trainingProgress.moduleId, moduleId)));

    if (existing.length === 0) {
      const [newProgress] = await db
        .insert(trainingProgress)
        .values({
          userId,
          moduleId,
          isCompleted: 0,
          progressPercent: progressPercent || 0,
          startedAt: new Date(),
        })
        .returning();
      return res.json({ success: true, progress: newProgress });
    }

    const [updated] = await db
      .update(trainingProgress)
      .set({
        progressPercent: progressPercent || existing[0].progressPercent,
        updatedAt: new Date(),
      })
      .where(and(eq(trainingProgress.userId, userId), eq(trainingProgress.moduleId, moduleId)))
      .returning();

    res.json({ success: true, progress: updated });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

router.post("/progress/:moduleId/complete", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { moduleId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const parseResult = completeModuleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request body", details: parseResult.error.errors });
    }
    const { quizScore } = parseResult.data;

    const existing = await db
      .select()
      .from(trainingProgress)
      .where(and(eq(trainingProgress.userId, userId), eq(trainingProgress.moduleId, moduleId)));

    if (existing.length === 0) {
      const [newProgress] = await db
        .insert(trainingProgress)
        .values({
          userId,
          moduleId,
          isCompleted: 1,
          progressPercent: 100,
          quizScore: quizScore || null,
          startedAt: new Date(),
          completedAt: new Date(),
        })
        .returning();
      return res.json({ success: true, progress: newProgress });
    }

    const [updated] = await db
      .update(trainingProgress)
      .set({
        isCompleted: 1,
        progressPercent: 100,
        quizScore: quizScore || existing[0].quizScore,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(trainingProgress.userId, userId), eq(trainingProgress.moduleId, moduleId)))
      .returning();

    res.json({ success: true, progress: updated });
  } catch (error) {
    console.error("Error completing module:", error);
    res.status(500).json({ error: "Failed to complete module" });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const allModules = await db
      .select()
      .from(trainingModules)
      .where(eq(trainingModules.isActive, 1));

    const userProgress = await db
      .select()
      .from(trainingProgress)
      .where(eq(trainingProgress.userId, userId));

    const totalModules = allModules.length;
    const completedModules = userProgress.filter(p => p.isCompleted === 1).length;
    const inProgressModules = userProgress.filter(p => p.isCompleted === 0 && (p.progressPercent ?? 0) > 0).length;

    const categories: TrainingCategory[] = ["DRM", "SEO", "Alibaba", "SalesTools"];
    const categoryStats = categories.map(category => {
      const categoryModules = allModules.filter(m => m.category === category);
      const completed = categoryModules.filter(m => 
        userProgress.find(p => p.moduleId === m.id && p.isCompleted === 1)
      ).length;
      return {
        category,
        displayName: categoryDisplayNames[category],
        total: categoryModules.length,
        completed,
        progressPercent: categoryModules.length > 0 ? Math.round((completed / categoryModules.length) * 100) : 0,
      };
    });

    res.json({
      totalModules,
      completedModules,
      inProgressModules,
      overallPercent: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
      categoryStats,
    });
  } catch (error) {
    console.error("Error fetching training summary:", error);
    res.status(500).json({ error: "Failed to fetch training summary" });
  }
});

export default router;
