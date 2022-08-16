import { Element, parseXml } from 'libxmljs2';

type XmlNodeInfo = {
  id: string;
  tagName: string;
  params: Map<string, string>;
};
type XmlInfo = {
  namespace: string;
  nodes: XmlNodeInfo[];
};

export function getXmls(xml: string): XmlInfo | null {
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

    nodes.push({ id, tagName, params });
  }

  return { namespace, nodes: nodes };
}
