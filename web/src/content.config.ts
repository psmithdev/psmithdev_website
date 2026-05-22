import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Cover images live on R2 (CDN URL), not bundled. Schema accepts a URL string.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    category: z.enum(['essay', 'making', 'tech']),
    cover: z.url().optional(),
    coverAlt: z.string().optional(),
    excerpt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const travel = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/travel' }),
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    visitedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.url().optional(),
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
