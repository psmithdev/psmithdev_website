import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const travel = await getCollection('travel', ({ data }) => !data.draft);

  const items = [
    ...posts.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.publishedAt,
      description: entry.data.excerpt ?? '',
      link: `/posts/${entry.slug}/`,
      categories: entry.data.tags,
    })),
    ...travel.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.publishedAt,
      description:
        entry.data.excerpt ??
        `Travel notes from ${entry.data.location.city}, ${entry.data.location.country}.`,
      link: `/travel/${entry.slug}/`,
      categories: [...entry.data.tags, 'travel'],
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Parker Smith',
    description: 'Travel, essays, and things made by hand.',
    site: context.site ?? 'https://psmith.dev',
    items,
  });
}
