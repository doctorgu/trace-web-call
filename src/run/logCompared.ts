import { trimEnd, trimEnds } from '../common/util';
import { config } from '../config/config';
import tCommon from '../sqlTemplate/TCommon';

export function logCompared() {
  // Composite2 -> Composite
  const nameDest = config.name.substring(0, config.name.length - 1);
  const pathDest = `${config.path.databaseDirectory}/${nameDest}.db`;
  const { diffTable, insertedTable, deletedTable, diffJsp, insertedJsp, deletedJsp } = tCommon.selectCompare(pathDest);
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
    console.log(
      'diffTable',
      JSON.stringify(
        diffTable.filter((v, i) => i <= 5),
        null,
        '  '
      )
    );
  }
  if (insertedTable.length) {
    console.log(
      'insertedTable',
      JSON.stringify(
        insertedTable.filter((v, i) => i <= 5),
        null,
        '  '
      )
    );
  }
  if (deletedTable.length) {
    console.log(
      'deletedTable',
      JSON.stringify(
        deletedTable.filter((v, i) => i <= 5),
        null,
        '  '
      )
    );
  }

  if (diffJsp.length) {
    console.log(
      'diffJsp',
      JSON.stringify(
        diffJsp.filter((v, i) => i <= 5),
        null,
        '  '
      )
    );
  }
  if (insertedJsp.length) {
    console.log(
      'insertedJsp',
      JSON.stringify(
        insertedJsp.filter((v, i) => i <= 5),
        null,
        '  '
      )
    );
  }
  if (deletedJsp.length) {
    console.log(
      'deletedJsp',
      JSON.stringify(
        deletedJsp.filter((v, i) => i <= 5),
        null,
        '  '
      )
    );
  }
}
