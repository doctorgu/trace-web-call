import { Element, parseXml } from 'libxmljs2';
import { removeCommentSql } from './util';

export type XmlNodeInfo = {
  id: string;
  tagName: string;
  params: Map<string, string>;
  tables: Set<string>;
};
export type XmlInfo = {
  namespace: string;
  nodes: XmlNodeInfo[];
};
export type XmlNodeInfoFind = XmlNodeInfo & {
  namespace: string;
};

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

function getTables(words: Map<string, number>, tablesAll: Set<string>): Set<string> {
  const tables = new Set<string>();

  for (const [word] of words) {
    if (tablesAll.has(word)) {
      tables.add(word);
    }
  }

  return tables;
}

export function getXmlInfo(xml: string, tablesAll: Set<string>): XmlInfo | null {
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

    const text = elem.text();
    const sql = removeCommentSql(text);
    const words = getWords(sql);
    const tables = getTables(words, tablesAll);

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

    nodes.push({ id, tagName, params, tables: new Set(tables) });
  }

  return { namespace, nodes: nodes };
}
