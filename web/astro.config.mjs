import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function rehypeLazyImages() {
  return (tree) => {
    function visit(node) {
      if (node?.type === 'element' && node.tagName === 'img') {
        node.properties ??= {};
        node.properties.loading ??= 'lazy';
        node.properties.decoding ??= 'async';
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
