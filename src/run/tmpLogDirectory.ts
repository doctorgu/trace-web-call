import { promisify } from 'util';
import { exec } from 'child_process';
import { writeFileSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { parse } from 'java-parser';
// import { config } from '../config/config';
import { getDbPath } from '../common/common';
import { emptyDirectory, findFiles, includesPath, readFileSyncUtf16le, testWildcardFileName } from '../common/util';
import {
  convertCstWithLocationToCstSimple,
  getCstWithLocation,
  getCstWithLocationFromContent,
  PathsAndImage,
} from '../common/cstSimpleHelper';
import { getPathsAndImagesFromCstSimple } from '../common/cstHelper';
import { getCstWithLocationFromDb, getFindsByClassPathClassNameFromDb } from '../common/classHelper';
import tXmlInfo from '../sqlTemplate/TXmlInfo';
import { getXmlNodeInfoFindByNamespaceId } from '../common/sqlMapperHelper';

const runExec = promisify(exec);

type FileType = 'controller' | 'dao' | 'xml' | 'unknown';

const config = {
  keyName: 'hmall_pc_was',
  xmlDirectory: 'hdhs_hmall/hmall_pc_was/src/main/resources/hmall/sqlmap/hmall',
  rootDir: 'C:/source/hmall',
  rootSrc: 'hdhs_hmall/hmall_pc_was',
  rootDest: 'demo',
  rootSrcDependency: ['hdhs_core/hshop_core', 'hdhs_core/hshop_order', 'hdhs_core/hshop_prmo'],
  skipIfExists: false,
  namespaceToCopy: ['hmall', 'hshop'],
  srcMainJava: 'src/main/java',
  srcMainResources: 'src/main/resources',
  replaces: {
    controller: [
      [
        'import org.springframework.web.servlet.view.json.MappingJacksonJsonView;',
        'import org.springframework.web.servlet.view.json.MappingJackson2JsonView;',
      ],
      ['@Controller', '@RestController'],
    ],
    dao: [],
    xml: [],
  },
  actions: {
    controller: [],
    dao: [addComponentToClass],
    xml: [],
  },
};

function addComponentToClass(content: string): string {
  const cstWithLocation = getCstWithLocationFromContent(content);
  return '';
}

function getFileType(fullPath: string): FileType {
  const fileName = basename(fullPath);
  const ext = extname(fileName);
  if (ext === '.java') {
    if (testWildcardFileName('*Cont*oller.java', fileName)) {
      return 'controller';
    } else if (testWildcardFileName('*DAO.java', fileName)) {
      return 'dao';
    } else if (testWildcardFileName('*.xml', fileName)) {
      return 'xml';
    }
  }

  return 'unknown';
}

function getFullPathSrc(fullPathSrcMaybe: string, isFolder: boolean): string[] {
  if (isFolder) {
    const paths = [...findFiles(fullPathSrcMaybe, '*', true)];
    if (paths.length) return paths;

    for (const src of config.rootSrcDependency) {
      const cur = fullPathSrcMaybe.replace(`${config.rootDir}/${config.rootSrc}`, `${config.rootDest}/${src}`);
      if (existsSync(cur)) {
        const paths = [...findFiles(cur, '*', true)];
        if (paths.length) return paths;
      }
    }
  } else {
    if (existsSync(fullPathSrcMaybe)) return [fullPathSrcMaybe];

    for (const src of config.rootSrcDependency) {
      const cur = fullPathSrcMaybe.replace(`${config.rootDir}/${config.rootSrc}`, `${config.rootDir}/${src}`);
      if (existsSync(cur)) return [cur];
    }
  }

  throw new Error(`${fullPathSrcMaybe} and other was not found.`);
}
function getFullPathDest(fullPathSrc: string, isXml: boolean = false): string {
  const srcMainWhat = isXml ? config.srcMainResources : config.srcMainJava;

  const idx = fullPathSrc.indexOf(srcMainWhat);
  if (idx === -1) {
    throw new Error(`${srcMainWhat} was not found.`);
  }

  const start = idx + srcMainWhat.length;
  const rest = fullPathSrc.substring(start);
  return `${config.rootDir}/${config.rootDest}/${srcMainWhat}/${rest}`;
}

function getSubSrcAndDest(fullPath: string): [string, string][] {
  const srcDests: [string, string][] = [];

  const fileType = getFileType(fullPath);

  switch (fileType) {
    case 'controller':
    case 'dao':
      {
        const cstWithLocation = getCstWithLocationFromDb(fullPath);
        const list: any[] = cstWithLocation?.ordinaryCompilationUnit?.importDeclaration;
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const namespaces = item.packageOrTypeName.Identifier.map((id: any) => id.image);
            const endsWithStar = item?.Star !== undefined;
            if (!config.namespaceToCopy.includes(namespaces[0])) continue;

            // hmall/cp/cpa/service/CPACsegLnbSrvyService
            const namespace = namespaces.join('/');

            // C:/source/hmall/hdhs_hmall/hmall_pc_was/src/main/java/hmall/cp/cpa/service/CPACsegLnbSrvyService.java
            const fullPathSrcMaybe = `${config.rootDir}/${config.rootSrc}/${config.srcMainJava}/${namespace}${
              !endsWithStar ? '.java' : ''
            }`;
            const fullPathsSrc = getFullPathSrc(fullPathSrcMaybe, endsWithStar);
            for (const fullPathSrc of fullPathsSrc) {
              // C:/source/hmall/demo/src/main/java/hmall/cp/cpa/service/CPACsegLnbSrvyService.java
              const fullPathDest = getFullPathDest(fullPathSrc);

              srcDests.push([fullPathSrc, fullPathDest]);
            }
          }
        }

        if (fileType === 'dao') {
          const classPath = getDbPath(config.rootDir, fullPath);
          const finds = getFindsByClassPathClassNameFromDb(config.keyName, classPath, '');
          for (const { callers } of finds) {
            for (const { stringLiteral } of callers) {
              if (!stringLiteral) continue;

              const ret = getXmlNodeInfoFindByNamespaceId(config.keyName, [config.xmlDirectory], stringLiteral);
              if (!ret) continue;

              const { xmlPath } = ret;

              const fullPathSrc = `${config.rootDir}/${xmlPath}`;
              const fullPathDest = getFullPathDest(xmlPath, true);
              srcDests.push([fullPathSrc, fullPathDest]);
            }
          }
        }
      }
      break;
    case 'xml':
      // Nothing yet
      break;
  }

  return srcDests;
}

function changeContent(contentSrc: string, fileType: FileType): string {
  let content = contentSrc;

  const replaces: string[][] =
    (fileType === 'controller' && config.replaces.controller) ||
    (fileType === 'dao' && config.replaces.dao) ||
    (fileType === 'xml' && config.replaces.xml) ||
    [];
  for (const [find, replace] of replaces) {
    content = content.replace(find, replace);
  }

  const actions: Function[] =
    (fileType === 'controller' && config.actions.controller) ||
    (fileType === 'dao' && config.actions.dao) ||
    (fileType === 'xml' && config.actions.xml) ||
    [];
  for (const action of actions) {
    content = action(content);
  }
  return content;
}

function copyImported(srcDests: string[][]) {
  for (const [fullPathSrc, fullPathDest] of srcDests) {
    const cstWithLocation = getCstWithLocationFromDb(fullPathSrc);
    const contentSrc = readFileSyncUtf16le(fullPathSrc);

    const fileType = getFileType(fullPathSrc);
    let contentDest = changeContent(contentSrc, fileType);

    // copyFileSync(fullPathSrc, fullPathDest);
  }
}

function getSrcAndDest(fullPathSrc: string, srcAndSrcDest: Map<string, [string, string][]>): void {
  const fullPathDest = getFullPathDest(fullPathSrc);

  // if (config.skipIfExists && existsSync(fullPathSrc)) {
  //   return;
  // }

  if (srcAndSrcDest.has(fullPathSrc)) {
    return;
  }

  let srcDests: [string, string][] = [[fullPathSrc, fullPathDest]];
  srcAndSrcDest.set(fullPathSrc, srcDests);

  const srcDestsSub = getSubSrcAndDest(fullPathSrc);
  srcDests = srcDests.concat(srcDestsSub);

  for (const [fullPathSrc] of srcDests) {
    getSrcAndDest(fullPathSrc, srcAndSrcDest);
  }

  // copyImported(srcDests);

  // copyFileSync(pathSrc, pathDest);
}

export function copyFile(fullPathSrc: string) {
  const srcAndSrcDest = new Map<string, [string, string][]>();
  getSrcAndDest(fullPathSrc, srcAndSrcDest);

  const srcAndDest = new Map<string, string>();
  for (const [, srcDests] of srcAndSrcDest) {
    for (const [fullPathSrc, fullPathDest] of srcDests) {
      srcAndDest.set(fullPathSrc, fullPathDest);
    }
  }

  console.log(srcAndDest);
}
// copyController('src/main/java/hmall/cp/cpa/web/CPACsegLnbSrvyController.java');

// ts-node ./src/run/tmpLogDirectory.ts
