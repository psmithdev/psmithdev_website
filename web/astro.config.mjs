import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const imageMetadata = JSON.parse(
  readFileSync(new URL('./src/data/image-metadata.json', import.meta.url), 'utf8')
);

function rehypeLazyImages() {
  return (tree) => {
    function visit(node) {
      if (node?.type === 'element' && node.tagName === 'img') {
        node.properties ??= {};
        node.properties.loading ??= 'lazy';
        node.properties.decoding ??= 'async';
        node.properties.sizes ??=
          '(min-width: 42rem) 38rem, calc(100vw - 2.4rem)';
        const image = imageMetadata[node.properties.src];
        if (image) {
          node.properties.width ??= String(image.width);
          node.properties.height ??= String(image.height);
        }
      }
      if (Array.isArray(node?.children)) {
        for (const child of node.children) visit(child);
      }
    }
    visit(tree);
  };
}

export default defineConfig({
  site: 'https://psmith.dev',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypeLazyImages],
    shikiConfig: { theme: 'github-light', wrap: true },
  },
});
