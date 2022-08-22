import { readdirSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * Escapes string for use in Javascript regex
 *
 * https://stackoverflow.com/a/3561711/675333
 */
export function escapeRegexp(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function removeComment(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

export function removeCommentSql(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\/|--.*/g, '');
}

/*
--Example
console.log(trimSpecific('"a"b"', '"') === 'a"b');
console.log(trimSpecific('""ab"""', '"') === 'ab');
console.log(trimSpecific('"', '"') === '');
console.log(trimSpecific('"a', '"') === 'a');
console.log(trimSpecific('a"', '"') === 'a');
console.log(trimSpecific('[a]', '[]') === 'a');
console.log(trimSpecific('{[a]}', '[{}]') === 'a');
*/
export function trimSpecific(value: string, find: string): string {
  const find2 = escapeRegexp(find);
  return value.replace(new RegExp(`^[${find2}]*(.*?)[${find2}]*$`), '$1');
}

export function getCommentRange(value: string): [number, number][] {
  const range: [number, number][] = [];

  let m: RegExpExecArray | null;
  const re = /\/\*[\s\S]*?\*\/|\/\/.*/g;
  while ((m = re.exec(value)) !== null) {
    const from = m.index as number;
    const to = from + m[0].length - 1;
    range.push([from, to]);
  }
  return range;
}

/*
console.log(getClosingPosition('((a)(b(c)))', 0, '(', ')') === 10);
console.log(getClosingPosition('((a)(b(c)))', 1, '(', ')') === 3);
console.log(getClosingPosition('((a)(b(c)))', 4, '(', ')') === 9);
console.log(getClosingPosition('((a)(b(c)))', 6, '(', ')') === 8);
*/
export function getClosingPosition(
  value: string,
  posOpen: number,
  symbolOpen: string,
  symbolClose: string,
  range: [number, number][] = []
): number {
  let counter = 1;

  for (let i = posOpen + 1; i < value.length; i += 1) {
    const found = range.find(([start, end]) => i >= start && i <= end);
    if (found) {
      i = found[1];
      continue;
    }

    const c = value[i];
    if (c === symbolOpen) {
      counter += 1;
    } else if (c === symbolClose) {
      counter -= 1;
    }

    if (counter === 0) {
      return i;
    }
  }

  throw new Error(`Closing symbol not found after ${posOpen} index.`);
}

export function getClosingQuote(value: string, posOpen: number, quoteSymbol = '"', escapeChar = '\\'): number {
  for (let i = posOpen + 1; i < value.length; i += 1) {
    const c = value[i];
    if (c === escapeChar) {
      i += 1;
      continue;
    }

    if (c === '\r' || c === '\n') {
      throw new Error(`Found \\r or \\n character before finding closing quote after ${posOpen} index.`);
    }

    if (c === quoteSymbol) {
      return i;
    }
  }

  throw new Error(`Closing quote not found after ${posOpen} index.`);
}

export function matchOf(
  value: string,
  regexp: RegExp,
  index: number
): { index: number; match: RegExpExecArray } | null {
  const valueNew = value.substring(index);

  const m = regexp.exec(valueNew);
  if (!m) return null;

  const match = m as RegExpExecArray;
  return { index: (match.index as number) + index, match };
}

export function lastMatchOf(
  value: string,
  regexp: RegExp,
  index: number
): { index: number; match: RegExpExecArray } | null {
  const valueNew = value.substring(0, index);

  if (!regexp.flags.includes('g')) {
    throw new Error('g flag must be included.');
  }

  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = regexp.exec(valueNew)) !== null) {
    lastMatch = m;
  }
  if (!lastMatch) return null;

  const match = lastMatch as RegExpExecArray;
  return { index: match.index, match };
}

export function indexOfSkipRange(
  value: string,
  find: string,
  index: number,
  range: [number, number][],
  reverse: boolean = false
): number {
  let indexNew = index;

  while (reverse ? indexNew >= 0 : indexNew < value.length) {
    const pos = reverse ? value.lastIndexOf(find, indexNew) : value.indexOf(find, indexNew);
    if (pos === -1) return -1;

    const found = range.find(([start, end]) => pos >= start && pos <= end);
    if (!found) {
      return pos;
    }

    const [from, to] = found;
    indexNew = reverse ? from - 1 : to + 1;
  }

  return -1;
}

export function matchOfSkipRange(
  value: string,
  find: RegExp,
  index: number,
  range: [number, number][],
  reverse: boolean = false
): { index: number; match: RegExpExecArray } | null {
  let indexNew = index;

  while (reverse ? indexNew >= 0 : indexNew < value.length) {
    const ret = reverse ? lastMatchOf(value, find, indexNew) : matchOf(value, find, indexNew);
    if (!ret) return null;

    const pos = ret.index;

    const found = range.find(([start, end]) => pos >= start && pos <= end);
    if (!found) {
      return ret;
    }

    const [from, to] = found;
    indexNew = reverse ? from - 1 : to + 1;
  }

  return null;
}

export function getLiteralRange(value: string, rangeComment: [number, number][]): [number, number][] {
  const quoteSymbol = '"';
  const escapeChar = '\\';

  const range: [number, number][] = [];
  let posOpen = indexOfSkipRange(value, quoteSymbol, 0, rangeComment);
  while (posOpen >= 0) {
    const posClose = getClosingQuote(value, posOpen, quoteSymbol, escapeChar);
    range.push([posOpen, posClose]);

    posOpen = indexOfSkipRange(value, quoteSymbol, posClose + 1, rangeComment);
  }

  return range;
}

export function testWildcardFileName(pattern: string, fileName: string, ignoreCase: boolean = true): boolean {
  // escape except star(*) and question(?), * -> .*, ? -> .?
  const pattern2 = pattern
    .replace(/[-\/\\^$+.()|[\]{}]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.?');
  const ret = new RegExp(`^${pattern2}$`, ignoreCase ? 'i' : '').test(fileName);
  return ret;
}

// for await (const fullPath of findFiles(rootDir)) { }
export function* findFiles(rootDir: string, pattern: string | RegExp = ''): string | any | undefined {
  const files = readdirSync(rootDir);

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const fullPath = resolve(rootDir, file);
    if (statSync(fullPath).isDirectory()) {
      yield* findFiles(fullPath, pattern);
    } else {
      if (pattern) {
        if (typeof pattern === 'string') {
          if (testWildcardFileName(pattern, file)) yield fullPath;
        } else {
          if (pattern.test(file)) yield fullPath;
        }
      } else {
        yield fullPath;
      }
    }
  }
}

// function last<T>(list: T[]): T {
//   return list[list.length - 1];
// }
