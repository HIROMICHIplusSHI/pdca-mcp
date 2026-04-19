// dist/index.js の先頭に shebang を追加し実行権限を付与する。
// npx 経由で実行されるCLIエントリのため、node が直接起動できる必要がある。
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';

const target = 'dist/index.js';
const shebang = '#!/usr/bin/env node\n';

const current = readFileSync(target, 'utf8');
if (!current.startsWith('#!')) {
  writeFileSync(target, shebang + current);
}
chmodSync(target, 0o755);
