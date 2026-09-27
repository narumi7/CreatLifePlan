/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 本番ビルドでは Content-Security-Policy で外部通信を禁止し、
// 入力した家計データがブラウザの外へ送信されないことを保証する。
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// --mode artifact: claude.ai のアーティファクトとして公開する1ファイル版を dist-artifact/ に出力する。
// 公開先が独自の CSP をかけるため、CSP の meta は入れずにすべてを1つのスクリプトにまとめる。
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'artifact' ? [react()] : [react(), cspPlugin()],
  build: {
    chunkSizeWarningLimit: 3000,
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    rollupOptions: mode === 'artifact' ? { output: { inlineDynamicImports: true } } : undefined,
  },
  test: {
    environment: 'node',
  },
}));
