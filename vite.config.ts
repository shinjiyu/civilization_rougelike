import path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@data': path.resolve(__dirname, 'src/data'),
      '@game': path.resolve(__dirname, 'src/game'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
  build: {
    target: 'es2017',            // 兼容百度/夸克/迅雷等国产浏览器 (Chromium 63+)
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    minify: 'esbuild',
  },
});
