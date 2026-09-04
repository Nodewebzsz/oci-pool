// OCI-Pool Modern UI · 构建脚本（方案 B：逐文件预编译，不合并）
// 把 static/modern-ui 下所有 .jsx 用 esbuild 转成同名 .js 输出到 dist/，
// 保留原有按 <script> 顺序加载 / 全局作用域共享的语义，去掉浏览器端 Babel 运行时转译。
import { transform } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(here, '..', 'src', 'main', 'resources', 'static', 'modern-ui');
const distRoot = join(sourceRoot, 'dist');

rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });

// 递归收集所有 .jsx 源文件（剔除 dist 目录，避免重复）
function* walkJsx(dir, base = dir, skip = []) {
  const items = readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory() && skip.includes(item.name)) continue;
    const p = join(dir, item.name);
    if (item.isDirectory()) {
      yield* walkJsx(p, base, skip);
    } else if (/\.jsx$/.test(item.name)) {
      yield { abs: p, rel: relative(base, p).split(sep).join('/') };
    }
  }
}

const files = [...walkJsx(sourceRoot, sourceRoot, ['dist'])];
let count = 0;

for (const file of files) {
  const code = readFileSync(file.abs, 'utf8');
  const result = await transform(code, {
    loader: 'jsx',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
  });
  const outPath = join(distRoot, file.rel.replace(/\.jsx$/, '.js'));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, result.code);
  count++;
  console.log(`built  ${file.rel}  ->  dist/${file.rel.replace(/\.jsx$/, '.js')}`);
}

console.log(`\nDone: ${count} .jsx files compiled to ${relative(here, distRoot)}`);
