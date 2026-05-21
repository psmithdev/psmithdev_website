import { defineCollection, z } from 'astro:content';

// Cover images live on R2 (CDN URL), not bundled. Schema accepts a URL string.
const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    category: z.enum(['essay', 'making', 'tech']),
    cover: z.string().url().optional(),
    coverAlt: z.string().optional(),
    excerpt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const travel = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    visitedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().url().optional(),
    coverAlt: z.string().optional(),
    excerpt: z.string().optional(),
    presentation: z.enum(['standard', 'cinematic']).default('standard'),
    heroImage: z.string().optional(),
    heroAlt: z.string().optional(),
    kicker: z.string().optional(),
    location: z.object({
      city: z.string(),
      country: z.string(),
      lat: z.number(),
      lng: z.number(),
    }),
    stops: z
      .array(
        z.object({
          city: z.string(),
          country: z.string(),
          lat: z.number(),
          lng: z.number(),
        }),
      )
      .optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, travel };
