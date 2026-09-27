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

export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
  },
});
