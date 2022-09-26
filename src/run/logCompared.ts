import { trimEnd, trimEnds } from '../common/util';
import { config } from '../config/config';
import tCommon from '../sqlTemplate/TCommon';

export function logCompared() {
  // Composite2 -> Composite
  const nameDest = config.name.substring(0, config.name.length - 1);
  const pathDest = `${config.path.databaseDirectory}/${nameDest}.db`;
  const {
    diffTable,
    insertedTable,
    deletedTable,
    diffJsp,
    insertedJsp,
    deletedJsp,
    diffTableSql,
    insertedTableSql,
    deletedTableSql,
    diffJspSql,
    insertedJspSql,
    deletedJspSql,
  } = tCommon.selectCompare(pathDest);
  if (
    !diffTable.length &&
    !insertedTable.length &&
    !deletedTable.length &&
    !diffJsp.length &&
    !insertedJsp.length &&
    !deletedJsp.length
  ) {
    console.log('Not changed');
    return;
  }

  if (diffTable.length) {
    console.log('diffTable', diffTable.length, diffTableSql);
  }
  if (insertedTable.length) {
    console.log('insertedTable', insertedTable.length, insertedTableSql);
  }
  if (deletedTable.length) {
    console.log('deletedTable', deletedTable.length, deletedTableSql);
  }

  if (diffJsp.length) {
    console.log('diffJsp', diffJsp.length, diffJspSql);
  }
  if (insertedJsp.length) {
    console.log('insertedJsp', insertedJsp.length, insertedJspSql);
  }
  if (deletedJsp.length) {
    console.log('deletedJsp', deletedJsp.length, deletedJspSql);
  }
}
