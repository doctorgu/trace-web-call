import { promisify } from 'util';
import { exec } from 'child_process';
import { readdirSync, copyFileSync, unlinkSync, constants } from 'fs';
import { basename } from 'path';

const runExec = promisify(exec);

export async function copyModifiedUntracked() {
  const destPath = `D:/Temp/trace-web-call`;
  const path7Z = `"C:/Program Files/7-Zip/7Z"`;
  const destZipFile = `trace-web-call.pdf`;

  console.log(`Deleting all in ${destPath}...`);
  const destFiles = readdirSync(destPath);
  for (let i = 0; i < destFiles.length; i++) {
    const destFile = destFiles[i];
    // console.log(`${destPath}/${destFile}`);
    unlinkSync(`${destPath}/${destFile}`);
  }

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
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];

    // const cmd = `copy ${path.replace(/\//g, '\\')} ${destPath}\\${basename(path)}`;
    // const ret = await runExec(cmd);

    copyFileSync(`${path}`, `${destPath}/${basename(path)}`);
  }

  console.log(`Zipping ${paths.length} count...`);
  const cmdZip = `${path7Z} a -tzip ${destPath}/${destZipFile} ${destPath}/*.*`;
  const { stdout: stdoutZip, stderr: stderrZip } = await runExec(cmdZip);
  if (stderrZip) {
    throw new Error(`${stderrZip}`);
  }
  console.log(stdoutZip);

  console.log('Completed');
}
copyModifiedUntracked();
