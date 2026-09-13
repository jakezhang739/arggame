/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

/** SITE_BASE：GitHub Pages 部署基址。默认子路径 /arggame/（仓库名）；根站点用 SITE_BASE=root 构建
 *  （避免 Windows Git Bash 把字面量 / 转成 MSYS 安装路径）。 */
const rawBase = process.env.SITE_BASE === 'root' ? '/' : (process.env.SITE_BASE ?? '/arggame/');
const base = rawBase === '/' ? '/' : rawBase.replace(/\/*$/, '/');

export default defineConfig({
  base,
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
