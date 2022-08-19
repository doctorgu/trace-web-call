import { Element, parseXml } from 'libxmljs2';
import { removeCommentSql, trimSpecific } from './util';

export type XmlNodeInfo = {
  id: string;
  tagName: string;
  params: Map<string, string>;
  tables: Set<string>;
  viewAndTables: ViewAndTables;
};
export type XmlInfo = {
  namespace: string;
  nodes: XmlNodeInfo[];
};
export type XmlNodeInfoFind = XmlNodeInfo & {
  namespace: string;
};

export type ViewAndTables = Map<string, Set<string>>;

function getWords(sql: string): Map<string, number> {
  const words = new Map<string, number>();

  let m: RegExpExecArray | null;
  const re = /\w+/g;
  while ((m = re.exec(sql)) !== null) {
    const word = m[0];
    const count = (words.has(word) ? (words.get(word) as number) : 0) + 1;
    words.set(word, count);
  }

  return words;
}

function getObjects(
  words: Map<string, number>,
  tablesAll: Set<string>,
  viewAndTablesAll: ViewAndTables
): { tables: Set<string>; viewAndTables: ViewAndTables } {
  const tables = new Set<string>();
  const viewAndTables: ViewAndTables = new Map<string, Set<string>>();

  for (const [word] of words) {
    if (tablesAll.has(word)) {
      tables.add(word);
    }

    //const index = viewAndTablesAll.findIndex(({ view }) => view === word);
    if (viewAndTablesAll.has(word)) {
      const tablesInView = viewAndTablesAll.get(word) || new Set<string>();
      viewAndTables.set(word, tablesInView);
      [...tablesInView].forEach((t) => tables.add(t));
    }
  }

  return { tables, viewAndTables };
}

export function getViewAndTables(viewSql: string, tablesAll: Set<string>): ViewAndTables {
  const sqlNoComment = removeCommentSql(viewSql);

  const viewAndTables: ViewAndTables = new Map<string, Set<string>>();
  let m: RegExpExecArray | null;
  let re =
    /create(\s+or\s+replace)*((\s+no)*(\s+force))*\s+view\s+(?<schemaDot>"?[\w$#]+"?\.)*(?<view>"?[\w$#]+"?)\s+.+?as(?<sql>.+?);/gis;
  while ((m = re.exec(sqlNoComment)) !== null) {
    // const schemaDot = m.groups?.schemaDot || '';
    const view = trimSpecific(m.groups?.view || '', '"');
    const sql = m.groups?.sql || '';

    const words = getWords(sql);
    const { tables } = getObjects(words, tablesAll, new Map<string, Set<string>>());
    viewAndTables.set(`${view}`, tables);
  }

  return viewAndTables;
}

function getTextInclude(parent: Element, root: Element) {
  const childNodes = parent.childNodes();
  const texts: string[] = [];
  for (const childNode of childNodes) {
    const elem = childNode as Element;
    if (!elem.attr) continue;

    const tagName = elem.name();
    if (tagName !== 'include') continue;

    const refid = elem.attr('refid')?.value();
    const nodeFound = root.get(`sql[@id='${refid}']`);
    if (!nodeFound) continue;

    const elemFound = nodeFound as Element;
    texts.push(elemFound.text());
  }
  return texts.join('\n');
}

export function getXmlInfo(xml: string, tablesAll: Set<string>, viewAndTablesAll: ViewAndTables): XmlInfo | null {
  const doc = parseXml(xml);
  const root = doc.root();
  if (!root) return null;

  const namespace = root.attr('namespace')?.value() || '';

  const nodes: XmlNodeInfo[] = [];

  const childNodes = root.childNodes();
  for (const childNode of childNodes) {
    const elem = childNode as Element;
    // Skip text node
    if (!elem.attr) continue;

    const tagName = elem.name();
    if (tagName === 'sql') continue;

    const textInclude = getTextInclude(elem, root);
    const sqlInclude = removeCommentSql(textInclude);

    const text = elem.text();
    const sql = removeCommentSql(text);

    const words = getWords(`${sqlInclude}\n${sql}`);
    const { tables, viewAndTables } = getObjects(words, tablesAll, viewAndTablesAll);

    let id = '';
    const params = new Map<string, string>();
    const attrs = elem.attrs();
    for (const attr of attrs) {
      const attrName = attr.name();
      const attrValue = attr.value();
      if (attrName === 'id') {
        id = attrValue;
      } else {
        params.set(attrName, attrValue);
      }
    }
    if (!id) continue;

    nodes.push({ id, tagName, params, tables, viewAndTables });
  }

  return { namespace, nodes };
}
