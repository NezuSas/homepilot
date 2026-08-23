import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = process.cwd();
const gitDirectory = resolve(repositoryRoot, '.git');

if (!existsSync(gitDirectory)) {
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: repositoryRoot,
  stdio: 'inherit'
});