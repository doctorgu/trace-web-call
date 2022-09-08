import { promisify } from 'util';
import { readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';
import { config } from '../config/config';

const runExec = promisify(exec);

function getDirsWithDotGit(parentDir: string): string[] {
  let dirs: string[] = [];

  const files = readdirSync(parentDir);
  for (const file of files) {
    const fullPath = resolve(parentDir, file);
    if (statSync(fullPath).isDirectory()) {
      if (file === '.git') {
        dirs.push(parentDir);
        break;
      } else {
        const dirsCur = getDirsWithDotGit(fullPath);
        dirs = dirs.concat(dirsCur);
      }
    }
  }

  return dirs;
}

export async function logGitCount() {
  const initDir = config.path.source.rootDir;

  const dirs = getDirsWithDotGit(initDir);
  if (!dirs.length) {
    console.log(`No .git directory in ${initDir}`);
    return;
  }

  for (const dir of dirs) {
    process.chdir(dir);

    const cmd = 'git rev-list --left-right --count origin/master...master';
    try {
      const { stderr, stdout } = await runExec(cmd);
      if (stderr) {
        console.log(dir);
        console.error(stderr);
        continue;
      }

      const [left, right] = stdout.split('\t');
      const left2 = left.trim();
      const right2 = right.trim();
      if (left2 === '0' || right2 === '0') {
        console.log(`${dir} ${left2} ${right2}`);
      }
    } catch (ex) {
      console.log(dir);
      console.log(ex);
    }
  }
}
