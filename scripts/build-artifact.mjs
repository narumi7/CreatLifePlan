// dist-artifact/ のビルド結果を、CSS と JS をすべて埋め込んだ1つの HTML にまとめる。
// アーティファクトは公開時に <!doctype>/<html>/<head>/<body> が付くため、それらのタグは含めない。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-artifact';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"/g)].map((m) => readFileSync(join(dir, m[1]), 'utf8'));
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/([^"]+)"/g)].map((m) => readFileSync(join(dir, m[1]), 'utf8'));
if (css.length === 0 || js.length !== 1) throw new Error(`想定外のビルド結果です (css=${css.length}, js=${js.length})`);
// U+FFFD は文字列リテラル内にしか現れないため、エスケープ表記に置き換える
const safeJs = js[0].replace(/<\/script/gi, '<\\/script').replace(/\uFFFD/g, '\\uFFFD');
const out = `<title>${title}</title>
<meta name="referrer" content="no-referrer">
<style>
${css.join('\n')}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/lifeplan.html', out);
console.log(`artifact/lifeplan.html (${(out.length / 1024).toFixed(0)} KB)`);
