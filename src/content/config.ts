import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    tagline: z.string().optional(),
    highlightBooks: z.array(z.string()).optional(),
    heroCta: z.object({ label: z.string(), href: z.string() }).optional(),
    secondaryCta: z.object({ label: z.string(), href: z.string() }).optional(),
    heroImage: z.string().optional(),
    featuredPoem: z
      .object({
        title: z.string(),
        original: z.array(z.string()),
        translation: z.array(z.string())
      })
      .optional(),
    categories: z.array(z.object({ title: z.string(), items: z.array(z.string()) })).optional(),
    timeline: z
      .array(
        z.object({
          period: z.string(),
          role: z.string(),
          location: z.string().optional(),
          summary: z.string().optional()
        })
      )
      .optional()
  })
});

const poems = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    language: z.string(),
    translationTitle: z.string().optional(),
    lines: z.array(z.string()),
    translation: z.array(z.string()).optional(),
    theme: z.string().optional()
  })
});

const books = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    genre: z.string(),
    language: z.string().optional(),
    description: z.string(),
    status: z.string().default("Published"),
    cover: z.string().optional(),
    buyLink: z.string().optional()
  })
});

const achievements = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    year: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    link: z.string().optional()
  })
});

const press = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
    link: z.string(),
    type: z.enum(["article", "clip", "video"]).default("clip"),
    image: z.string().optional()
  })
});

const photos = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    caption: z.string().optional(),
    image: z.string(),
    credit: z.string().optional()
  })
});

const videos = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    url: z.string(),
    category: z.string().optional(),
    description: z.string().optional()
  })
});

export const collections = { pages, poems, books, achievements, press, photos, videos };
