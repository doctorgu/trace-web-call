import { promisify } from 'util';
import { exec } from 'child_process';
import { readdirSync, copyFileSync, rmSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { config } from '../config/config';
import { getDbPath } from '../common/common';
import { emptyDirectory } from '../common/util';

const runExec = promisify(exec);

export async function copyModifiedUntracked() {
  const rootDirDest = `D:/Temp/trace-web-call`;
  const path7Z = `"C:/Program Files/7-Zip/7Z"`;
  const destZipFile = `trace-web-call.pdf`;

  console.log(`Deleting all in ${rootDirDest}...`);
  emptyDirectory(rootDirDest);

  // diff --name-only: Modified
  // (To supress 'warning: LF will be replaced by CRLF in yarn.lock.' -> git config--global core.safecrlf false)
  // ls-files --others --exclude-standard: Untracked
  const { stdout: stdoutGit, stderr: stderrGit } = await runExec(
    'git diff --name-only & git ls-files --others --exclude-standard'
  );
  if (stderrGit) {
    throw new Error(`${stderrGit}`);
  }
  const paths = stdoutGit.split(/\n/).filter((path) => !!path);

  console.log(`Copying ${paths.length} count...`);
  for (const path of paths) {
    const fullPathSrc = resolve(process.cwd(), path);
    const subPath = getDbPath(process.cwd(), fullPathSrc);
    const fullPathDest = `${rootDirDest}/${subPath}`;
    const fullDirDest = dirname(fullPathDest);

    if (!existsSync(fullPathSrc)) {
      console.log(`*** deleted: ${fullPathSrc}`);
      continue;
    }

    if (!existsSync(fullDirDest)) {
      mkdirSync(fullDirDest, { recursive: true });
    }

    copyFileSync(fullPathSrc, fullPathDest);
  }

  console.log(`Zipping ${paths.length} count...`);
  const cmdZip = `${path7Z} a -r ${rootDirDest}/${destZipFile} ${rootDirDest}/*.*`;
  const { stdout: stdoutZip, stderr: stderrZip } = await runExec(cmdZip);
  if (stderrZip) {
    throw new Error(`${stderrZip}`);
  }
  // console.log(stdoutZip);

  console.log(`${destZipFile} created in ${rootDirDest}`);
}
