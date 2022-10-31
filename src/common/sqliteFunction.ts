export function regexp(pattern: string, value: string) {
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
export function testWildcardFileName(pattern: string, fileName: string, ignoreCase: number): number {
  // escape except star(*) and question(?), * -> .*, ? -> .?
  const pattern2 = pattern
    .replace(/[-\/\\^$+.()|[\]{}]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.?');
  const ret = new RegExp(`^${pattern2}$`, ignoreCase ? 'i' : '').test(fileName);
  return ret ? 1 : 0;
}

export function regexpReplace(value: string, find: string, option: string, replace: string): string {
  return value.replace(new RegExp(find, option), replace);
}

export function regexpSubstr(value: string, find: string, start: number, nth: number): string {
  // minus 1 to make same with oracle function
  const value2 = value.substring(start - 1);
  const re = new RegExp(find, 'g');
  let m = null;
  let count = 0;
  while ((m = re.exec(value2)) !== null) {
    count++;
    if (count === nth) {
      return m[0];
    }
  }

  return '';
}
