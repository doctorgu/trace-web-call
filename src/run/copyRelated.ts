import { promisify } from 'util';
import { exec } from 'child_process';
import { cpSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname, basename, extname, parse as pathParse } from 'path';
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
import { config } from '../config/config';

const runExec = promisify(exec);

type FileType = 'controller' | 'service' | 'dao' | '.java' | 'xml' | 'unknown';

const configCur = {
  keyName: 'hmall_pc_was',
  xmlDirectory: 'hdhs_hmall/hmall_pc_was/src/main/resources/hmall/sqlmap/hmall',
  rootSrc: 'hdhs_hmall/hmall_pc_was',
  rootDest: 'demo',
  rootSrcDependency: [
    'hdhs_core/hshop_core',
    'hdhs_core/hshop_order',
    'hdhs_core/hshop_prmo',
    'hdhs_hmall/hmall_hshop_order',
  ],
  serviceImplLocation: '{directory}/impl/{className}Impl.java',
  skipIfExists: false,
  namespaceStartToCopy: ['hmall', 'hshop'],
  namespaceStartToSkip: ['hshop/eai/HshopEAIOutbound'],
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
    xml: [changeMapper],
  },
};

function addComponentToClass(content: string): string {
  // add @Component
  const cstWithLocation = getCstWithLocationFromContent(content);
  return content;
}

function changeMapper(content: string): string {
  // dsHshopHmallNonXa-cpb.CPBCsegBbsDAO_sql.xml -> CPBCsegBbsDAO.xml
  // remove <typeAlias
  // <sqlMap -> <mapper
  // namespace="dsHshopHmallNonXa-cpb.CPBCsegBbsDAO" -> namespace="cpb.CPBCsegBbsDAO"
  // id="cpb.CPBCsegBbsDAO.selectImCsegDtlVO" -> id="selectImCsegDtlVO"
  // resultClass="cpborgnMst" -> resultType="hmall.cp.cpa.service.vo.CPAImOrgnMstVO"
  // (<typeAlias alias="cpborgnMst" type="hmall.cp.cpa.service.vo.CPAImOrgnMstVO" />)

  return content;
}

function getFileType(fullPath: string): FileType {
  const fileName = basename(fullPath);
  const ext = extname(fileName);
  if (ext === '.java') {
    if (testWildcardFileName('*Cont*oller.java', fileName)) {
      return 'controller';
    } else if (testWildcardFileName('*Service.java', fileName)) {
      return 'service';
    } else if (testWildcardFileName('*DAO.java', fileName)) {
      return 'dao';
    } else {
      return '.java';
    }
  } else if (ext === '.xml') {
    return 'xml';
  }

  return 'unknown';
}

function getFullPathSrc(fullPathSrcMaybe: string, endsWithStar: boolean, allowNotFound: boolean = false): string[] {
  let paths: string[] = [];

  if (endsWithStar) {
    paths = existsSync(fullPathSrcMaybe) ? [...findFiles(fullPathSrcMaybe, '*.java', true)] : [];
    if (!paths.length) {
      for (const srcDep of configCur.rootSrcDependency) {
        const cur = fullPathSrcMaybe.replace(
          `${config.path.source.rootDir}/${configCur.rootSrc}`,
          `${config.path.source.rootDir}/${srcDep}`
        );
        if (existsSync(cur)) {
          paths = [...findFiles(cur, '*.java', true)];
          if (paths.length) break;
        }
      }
    }
  } else {
    if (existsSync(fullPathSrcMaybe)) paths = [fullPathSrcMaybe];

    if (!paths.length) {
      for (const src of configCur.rootSrcDependency) {
        const cur = fullPathSrcMaybe.replace(
          `${config.path.source.rootDir}/${configCur.rootSrc}`,
          `${config.path.source.rootDir}/${src}`
        );
        if (existsSync(cur)) {
          paths = [cur];
          break;
        }
      }
    }
  }

  if (paths.length || allowNotFound) {
    return paths;
  }

  throw new Error(`${fullPathSrcMaybe} and other was not found.`);
}
function getFullPathDest(fullPathSrc: string): string {
  const isXml = extname(fullPathSrc) === '.xml';
  const srcMainWhat = isXml ? configCur.srcMainResources : configCur.srcMainJava;

  const idx = fullPathSrc.indexOf(srcMainWhat);
  if (idx === -1) {
    throw new Error(`${srcMainWhat} was not found.`);
  }

  const start = idx + srcMainWhat.length + 1;
  const rest = fullPathSrc.substring(start);
  return `${config.path.source.rootDir}/${configCur.rootDest}/${srcMainWhat}/${rest}`;
}

function getSubSrcAndDest(fullPath: string): [string, string][] {
  const srcDests: [string, string][] = [];

  const fileType = getFileType(fullPath);

  switch (fileType) {
    case 'controller':
    case 'dao':
    case 'service':
    case '.java':
      {
        const cstWithLocation = getCstWithLocationFromDb(fullPath);
        const list: any[] = cstWithLocation?.ordinaryCompilationUnit?.importDeclaration;
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const namespaces = item.packageOrTypeName.Identifier.map((id: any) => id.image);
            const endsWithStar = item?.Star !== undefined;
            const isStatic = item?.Static !== undefined;
            if (isStatic) {
              namespaces.pop();
            }

            // hmall/cp/cpa/service/CPACsegLnbSrvyService
            const namespace = namespaces.join('/');
            if (!configCur.namespaceStartToCopy.some((v) => namespace.startsWith(v))) continue;
            if (configCur.namespaceStartToSkip.some((v) => namespace.startsWith(v))) continue;

            // D:/source/hmall/hdhs_hmall/hmall_pc_was/src/main/java/hmall/cp/cpa/service/CPACsegLnbSrvyService.java
            const fullPathSrcMaybe = `${config.path.source.rootDir}/${configCur.rootSrc}/${
              configCur.srcMainJava
            }/${namespace}${!endsWithStar ? '.java' : ''}`;
            const fullPathsSrc = getFullPathSrc(fullPathSrcMaybe, endsWithStar);
            for (const fullPathSrc of fullPathsSrc) {
              // D:/source/hmall/demo/src/main/java/hmall/cp/cpa/service/CPACsegLnbSrvyService.java
              const fullPathDest = getFullPathDest(fullPathSrc);

              srcDests.push([fullPathSrc, fullPathDest]);
            }
          }
        }

        if (fileType === 'dao') {
          const classPath = getDbPath(config.path.source.rootDir, fullPath);
          const finds = getFindsByClassPathClassNameFromDb(configCur.keyName, classPath, '');
          for (const { callers } of finds) {
            for (const { stringLiteral } of callers) {
              if (!stringLiteral) continue;

              const ret = getXmlNodeInfoFindByNamespaceId(configCur.keyName, [configCur.xmlDirectory], stringLiteral);
              if (!ret) continue;

              const { xmlPath } = ret;

              const fullPathSrc = `${config.path.source.rootDir}/${xmlPath}`;
              const fullPathDest = getFullPathDest(xmlPath);
              srcDests.push([fullPathSrc, fullPathDest]);
            }
          }
        } else if (fileType === 'service') {
          const className = pathParse(fullPath).name;
          const directory = pathParse(fullPath).dir;

          // serviceImplLocation: '{directory}/impl/{className}Impl.java',
          const fullPathsSrc = getFullPathSrc(
            configCur.serviceImplLocation.replace('{directory}', directory).replace('{className}', className),
            false,
            true
          );
          for (const fullPathSrc of fullPathsSrc) {
            const fullPathDest = getFullPathDest(fullPathSrc);

            srcDests.push([fullPathSrc, fullPathDest]);
          }
        }
      }
      break;
    case 'xml':
      // Nothing yet
      break;
    default:
      throw new Error(`Wrong fileType: ${fileType}`);
  }

  return srcDests;
}

function changeContent(contentSrc: string, fileType: FileType): string {
  let content = contentSrc;

  const replaces: string[][] =
    (fileType === 'controller' && configCur.replaces.controller) ||
    (fileType === 'dao' && configCur.replaces.dao) ||
    (fileType === 'xml' && configCur.replaces.xml) ||
    [];
  for (const [find, replace] of replaces) {
    content = content.replace(find, replace);
  }

  const actions: Function[] =
    (fileType === 'controller' && configCur.actions.controller) ||
    (fileType === 'dao' && configCur.actions.dao) ||
    (fileType === 'xml' && configCur.actions.xml) ||
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

function getSrcAndSrcDests(fullPathSrc: string, srcAndSrcDests: Map<string, [string, string][]>): void {
  const fullPathDest = getFullPathDest(fullPathSrc);

  // if (config.skipIfExists && existsSync(fullPathSrc)) {
  //   return;
  // }

  if (srcAndSrcDests.has(fullPathSrc)) {
    return;
  }

  let srcDests: [string, string][] = [[fullPathSrc, fullPathDest]];
  srcAndSrcDests.set(fullPathSrc, srcDests);

  const srcDestsSub = getSubSrcAndDest(fullPathSrc);
  srcDests = srcDests.concat(srcDestsSub);

  for (const [fullPathSrc] of srcDests) {
    getSrcAndSrcDests(fullPathSrc, srcAndSrcDests);
  }

  // copyImported(srcDests);

  // copyFileSync(pathSrc, pathDest);
}

export function copyRelated(fullPathsSrc: string[]) {
  const srcAndSrcDests = new Map<string, [string, string][]>();

  for (const fullPathSrc of fullPathsSrc) {
    getSrcAndSrcDests(fullPathSrc, srcAndSrcDests);
  }

  const srcAndDest = new Map<string, string>();
  for (const [, srcDests] of srcAndSrcDests) {
    for (const [fullPathSrc, fullPathDest] of srcDests) {
      srcAndDest.set(fullPathSrc, fullPathDest);
    }
  }

  for (const [fullPathSrc, fullPathDest] of srcAndDest) {
    cpSync(fullPathSrc, fullPathDest);
  }
}

// const fullPathsP = [
//   ...findFiles(
//     `${config.path.source.rootDir}/hdhs_hmall/hmall_pc_was/src/main/java/hmall/cp`,
//     '*Cont*oller.java',
//     true
//   ),
// ];
// const fullPathsQ = [
//   ...findFiles(
//     `${config.path.source.rootDir}/hdhs_hmall/hmall_pc_was/src/main/java/hmall/cq`,
//     '*Cont*oller.java',
//     true
//   ),
// ];
// const fullPathsAll = [...fullPathsP, ...fullPathsQ];
// copyRelated(fullPathsAll);

// copyRelated(['src/main/java/hmall/cp/cpa/web/CPACsegLnbSrvyController.java']);

// ts-node ./src/run/copyRelated.ts
