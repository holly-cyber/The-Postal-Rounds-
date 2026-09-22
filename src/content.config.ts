import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Plain-text pages Holly can edit without touching code: src/content/pages/*.md.
 * Each file becomes the body of the page with the same name.
 */
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lede: z.string().optional(),
  }),
});

export const collections = { pages };
