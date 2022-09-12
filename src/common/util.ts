import { closeSync, openSync, readSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * Escapes string for use in Javascript regex
 *
 * https://stackoverflow.com/a/3561711/675333
 */
export function escapeRegexp(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Replace '$' to '$$' to prevent referencing group in replace.
 *
 * '<tbl>'.replace(/<(tbl)>/, 'table$1') => 'tabletbl'
 *
 * '<tbl>'.replace(/<(tbl)>/, 'table$$1') => 'table$1'
 */
export function escapeDollar(s: string): string {
  return s.replace(/\$/g, '$$$$');
}

export function removeComment(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

export function removeCommentSql(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\/|--.*/g, '');
}

/*
--Example
console.log(trimList('"a"b"', '"') === 'a"b');
console.log(trimList('""ab"""', '"') === 'ab');
console.log(trimList('"', '"') === '');
console.log(trimList('"a', '"') === 'a');
console.log(trimList('a"', '"') === 'a');
console.log(trimList('[a]', '[]') === 'a');
console.log(trimList('{[a]}', '[{}]') === 'a');
*/
export function trimList(value: string, find: string): string {
  const find2 = escapeRegexp(find);
  return value.replace(new RegExp(`^[${find2}]*(.*?)[${find2}]*$`), '$1');
}
export function trimStartList(value: string, find: string): string {
  const find2 = escapeRegexp(find);
  return value.replace(new RegExp(`^[${find2}]*(.*)`), '$1');
}
export function trimEndList(value: string, find: string): string {
  const find2 = escapeRegexp(find);
  return value.replace(new RegExp(`(.*?)[${find2}]*$`), '$1');
}
export function trimStart(value: string, find: string): string {
  const find2 = escapeRegexp(find);
  return value.replace(new RegExp(`^(?:${find2})*(.*)`), '$1');
}
export function trimEnd(value: string, find: string): string {
  const find2 = escapeRegexp(find);
  return value.replace(new RegExp(`(.*?)(?:${find2})*$`), '$1');
}

export function getClosingQuoteJava(value: string, posOpen: number): number {
  for (let i = posOpen + 1; i < value.length; i++) {
    const c = value[i];
    if (c === '\\') {
      i++;
      continue;
    }

    if (c === '\r' || c === '\n') {
      throw new Error(
        `Found \\r or \\n character before finding closing quote after ${posOpen} index in ${value.substr(
          posOpen,
          500
        )}`
      );
    }

    if (c === '"') {
      return i;
    }
  }

  throw new Error(`Closing quote not found after ${posOpen} index in in ${value.substr(posOpen, 500)}`);
}

export function getClosingQuoteSql(value: string, posOpen: number): number {
  for (let i = posOpen + 1; i < value.length; i++) {
    const c = value[i];
    if (c === "'") {
      const cNext = value[i + 1];
      if (cNext === "'") {
        i++;
        continue;
      }

      return i;
    }
  }

  throw new Error(`Closing quote not found after ${posOpen} index in ${value.substr(posOpen, 500)}`);
}

export function getClosingCommentDashSql(value: string, posOpen: number): number {
  for (let i = posOpen + 1; i < value.length; i++) {
    const c = value[i];
    if (c === '\r') {
      const isRn = value[i + 1] === '\n';
      return i + (isRn ? 1 : 0);
    } else if (c === '\n') {
      return i;
    }
  }

  return value.length - 1;
}

export function getClosingCommentSlash(value: string, posOpen: number): number {
  for (let i = posOpen + 1; i < value.length; i++) {
    const c = value[i];
    if (c !== '*') continue;

    const cNext = value[i + 1];
    if (cNext !== '/') continue;

    return i + 1;
  }

  throw new Error(`Closing slash not found after ${posOpen} index in ${value.substr(posOpen, 500)}`);
}

// console.log('Testing quote');
// console.log(removeCommentLiteralSql("''''") === '');
// console.log(removeCommentLiteralSql("a''b") === 'ab');
// console.log(removeCommentLiteralSql("a'x'b'y'c") === 'abc');
// console.log(removeCommentLiteralSql("a'x''y'b") === 'ab');
// console.log(removeCommentLiteralSql("a'x''y'b'z'''c") === 'abc');
// console.log(removeCommentLiteralSql("'a''b'") === '');
// console.log(removeCommentLiteralSql("a'\r'\nb") === 'a\nb');
// try {
//   console.log(removeCommentLiteralSql("a'") === 'a');
//   console.log(false);
// } catch (ex) {
//   console.log(true);
// }

// console.log('Testing dash');
// console.log(removeCommentLiteralSql('---') === '');
// console.log(removeCommentLiteralSql('a--\nb') === 'ab');
// console.log(removeCommentLiteralSql('a--\r\nb') === 'ab');
// console.log(removeCommentLiteralSql('a--x\nb--y\nc') === 'abc');
// console.log(removeCommentLiteralSql('--a\n--b') === '');

// console.log('Testing slash');
// console.log(removeCommentLiteralSql('/**//**/') === '');
// console.log(removeCommentLiteralSql('a/**/b') === 'ab');
// console.log(removeCommentLiteralSql('a/*x*/b/*y*/c') === 'abc');
// console.log(removeCommentLiteralSql('a/*x*//*y*/b') === 'ab');
// console.log(removeCommentLiteralSql('a/*x*//*y*/b/*z*//**/c') === 'abc');
// console.log(removeCommentLiteralSql('/*a*//*b*/') === '');
// console.log(removeCommentLiteralSql('a/*\r*/\nb') === 'a\nb');
// try {
//   console.log(removeCommentLiteralSql('a/*') === 'a');
//   console.log(false);
// } catch (ex) {
//   console.log(true);
// }

// console.log('Testing quote and dash');
// console.log(removeCommentLiteralSql("a'--b'c") === 'ac');
// console.log(removeCommentLiteralSql("'a--'b") === 'b');
// console.log(removeCommentLiteralSql("a--'b'b") === 'a');
// console.log(removeCommentLiteralSql("''--''--") === '');
// console.log(removeCommentLiteralSql("a--\r\n'b'c") === 'ac');

// console.log('Testing composite');
// console.log(removeCommentLiteralSql("a'--b/*'c") === 'ac');
// console.log(removeCommentLiteralSql("a'--b/*c*/d'c") === 'ac');
// console.log(removeCommentLiteralSql("a--b\n/*c*/d'c'") === 'ad');
// console.log(removeCommentLiteralSql('a/*b*/c') === 'ac');
// console.log(removeCommentLiteralSql('--a/*\nb*/c') === 'b*/c');
// console.log(removeCommentLiteralSql('/*a\r\nb*/c--d') === 'c');
export function removeCommentLiteralSql(value: string): string {
  let posCloseOld = -1;
  let posClose = -1;
  let values: string[] = [];

  for (let i = 0; i < value.length; i++) {
    const c = value[i];

    if (c === "'") {
      posClose = getClosingQuoteSql(value, i);
    } else if (c === '-') {
      const cNext = value[i + 1];
      if (cNext !== '-') continue;

      posClose = getClosingCommentDashSql(value, i);
    } else if (c === '/') {
      const cNext = value[i + 1];
      if (cNext !== '*') continue;

      posClose = getClosingCommentSlash(value, i);
    } else {
      continue;
    }

    values.push(value.substring(posCloseOld + 1, i));
    posCloseOld = posClose;
    i = posClose;
  }

  // Add right most value
  if (posClose + 1 < value.length) {
    values.push(value.substring(posClose + 1));
  }

  return values.join('');
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

export function regexpSqlite(pattern: string, value: string) {
  const ret = new RegExp(pattern).test(value);
  return ret ? 1 : 0;
}

// QtScript in SQLiteStudio:
// const pattern = arguments[0];
// const fileName = arguments[1];
// const ignoreCase = arguments[2];

// // escape except star(*) and question(?), * -> .*, ? -> .?
// const pattern2 = pattern
//   .replace(/[-\/\\^$+.()|[\]{}]/g, '\\$&')
//   .replace(/\*/g, '.*')
//   .replace(/\?/g, '.?');
// const ret = new RegExp('^' + pattern2 + '$', ignoreCase ? 'i' : '').test(fileName);
// return ret ? 1 : 0;
export function testWildcardFileNameSqlite(pattern: string, fileName: string, ignoreCase: number): number {
  // escape except star(*) and question(?), * -> .*, ? -> .?
  const pattern2 = pattern
    .replace(/[-\/\\^$+.()|[\]{}]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.?');
  const ret = new RegExp(`^${pattern2}$`, ignoreCase ? 'i' : '').test(fileName);
  return ret ? 1 : 0;
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

/**
 *
 * for await (const fullPath of findFiles(rootDir)) { }
 *
 * for (const fullPath of [...findFiles(rootDir)]) { }
 */
export function* findFiles(rootDir: string, pattern: string | RegExp = ''): string | any | undefined {
  const files = readdirSync(rootDir);

  for (let i = 0; i < files.length; i++) {
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

/**
 * https://stackoverflow.com/a/53187807/2958717
 * Returns the index of the last element in the array where predicate is true, and -1
 * otherwise.
 * @param array The source array to search in
 * @param predicate find calls predicate once for each element of the array, in descending
 * order, until it finds one where predicate returns true. If such an element is found,
 * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(array: Array<T>, predicate: (value: T, index: number, obj: T[]) => boolean): number {
  let l = array.length;
  while (l--) {
    if (predicate(array[l], l, array)) return l;
  }
  return -1;
}

/**
 * Get the encoding of a file from an optional BOM character.
 *
 * This will only work if there is a BOM characters, and they are rarely used since they are optional.
 *
 * @see https://en.wikipedia.org/wiki/Byte_order_mark
 *
 * @param filePath - The path of a file on which to check encoding.
 *
 * @returns The file encoding if found, otherwise "unknown".
 */
function getFileEncoding(filePath: string): string {
  const byteOrderMark = Buffer.alloc(5, 0); // Generate an empty BOM.
  const fileDescriptor = openSync(filePath, 'r');
  readSync(fileDescriptor, byteOrderMark, 0, 5, 0);
  closeSync(fileDescriptor);

  let encoding: string = '';

  if (!encoding && byteOrderMark[0] === 0xef && byteOrderMark[1] === 0xbb && byteOrderMark[2] === 0xbf)
    encoding = 'utf8';
  if (!encoding && byteOrderMark[0] === 0xfe && byteOrderMark[1] === 0xff) encoding = 'utf16be';
  if (!encoding && byteOrderMark[0] === 0xff && byteOrderMark[1] === 0xfe) encoding = 'utf16le';
  if (!encoding) encoding = 'unknown';

  return encoding;
}

export function readFileSyncUtf16le(path: string) {
  const fileEncoding = getFileEncoding(path);

  // BufferEncoding: ascii,base64,base64url,binary,hex,latin1,ucs-2,utf-8,utf16le,utf8
  let encoding: BufferEncoding = 'utf8';

  switch (fileEncoding) {
    case 'utf16le':
      encoding = 'utf16le';
      break;
  }

  return readFileSync(path, encoding);
}
