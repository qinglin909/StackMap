/* 把主工程 Web 资源同步到 mobile/www（Capacitor webDir）。
 * 用法：node sync-www.mjs
 * 仅拷贝运行所需文件：入口 HTML、脚本、样式、离线快照与 content/ 全量数据。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.dirname(HERE);
const WWW = path.join(HERE, 'www');

const FILES = ['index.html', 'data.js', 'core.js', 'v2.js', 'v3.js', 'cards.js',
  'views2.js', 'views3.js', 'app.js', 'styles.css'];
const DIRS = ['content'];

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

let count = 0, bytes = 0;
for (const f of FILES) {
  fs.copyFileSync(path.join(APP, f), path.join(WWW, f));
  count++; bytes += fs.statSync(path.join(WWW, f)).size;
}
for (const d of DIRS) {
  fs.cpSync(path.join(APP, d), path.join(WWW, d), { recursive: true });
}

const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { count++; bytes += fs.statSync(p).size; }
  }
};
walk(path.join(WWW, 'content'));
console.log(`sync-www 完成：${count} 个文件，共 ${(bytes / 1048576).toFixed(1)} MB`);
