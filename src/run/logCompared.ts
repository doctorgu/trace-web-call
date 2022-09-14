import { trimEnd, trimEndList } from '../common/util';
import { config } from '../config/config';
import tCommon from '../sqlTemplate/TCommon';

export function logCompared() {
  // Composite2 -> Composite
  const nameDest = config.name.substring(0, config.name.length - 1);
  const pathDest = `${config.path.databaseDirectory}/${nameDest}.db`;
  const { diff, inserted, deleted } = tCommon.selectCompare(pathDest);
  if (!diff.length && !inserted.length && !deleted.length) {
    console.log('Not changed');
    return;
  }

  if (diff.length) {
    console.log('diff', JSON.stringify(diff, null, '  '));
  }
  if (inserted.length) {
    console.log('inserted', JSON.stringify(inserted, null, '  '));
  }
  if (deleted.length) {
    console.log('deleted', JSON.stringify(deleted, null, '  '));
  }
}
