import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      category: z.enum(['essay', 'making', 'tech']),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      excerpt: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

const travel = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      visitedAt: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      excerpt: z.string().optional(),
      location: z.object({
        city: z.string(),
        country: z.string(),
        lat: z.number(),
        lng: z.number(),
      }),
      draft: z.boolean().default(false),
    }),
});

export const collections = { posts, travel };
