import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const cache = join(homedir(), 'Library/Caches/olgierdwww-build');
const req = createRequire(join(cache, 'index.js'));

let esbuild;
try {
  esbuild = req('esbuild');
} catch {
  mkdirSync(cache, { recursive: true });
  execSync(`npm i esbuild@0.24.0 --silent --no-audit --no-fund --prefix "${cache}"`, { stdio: 'inherit' });
  esbuild = req('esbuild');
}

const pages = ['index.html', 'blog/index.html', 'privacy.html'];
const js = (code) => esbuild.transformSync(code, { loader: 'js', minify: true, legalComments: 'none', charset: 'utf8' }).code.trim();
const css = (code) => esbuild.transformSync(code, { loader: 'css', minify: true, legalComments: 'none', charset: 'utf8' }).code.trim();

for (const page of pages) {
  let html = readFileSync(join(root, 'src', page), 'utf8');
  const kept = [];
  const keep = (s) => `\u0000${kept.push(s) - 1}\u0000`;

  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (whole, attrs, body) => {
    if (/\bsrc=/.test(attrs)) return keep(whole);
    if (/application\/ld\+json/.test(attrs)) return keep(`<script${attrs}>${JSON.stringify(JSON.parse(body))}</script>`);
    if (body.trim().startsWith('window.MOZG=')) {
      mkdirSync(join(root, 'public', 'js'), { recursive: true });
      writeFileSync(join(root, 'public', 'js', 'mozg.js'), body.trim().replace(/;?$/, ';\n'));
      return keep('<script src="js/mozg.js"></script>');
    }
    return keep(`<script${attrs}>${js(body)}</script>`);
  });
  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/g, (whole, attrs, body) => keep(`<style${attrs}>${css(body)}</style>`));
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/\s+/g, ' ').trim();
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);

  writeFileSync(join(root, 'public', page), html + '\n');
  console.log(`${page}: ${Buffer.byteLength(html)} bytes`);
}
