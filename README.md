# TraceWebCall

Shows all tables used when API called through Mapping annotation in controller.

Also shows all routes from API to SQL.

## Initial setup

- yarn config set prefix `C:\yarn_prefix`
- yarn global add typescript
- yarn global add ts-node
- add `C:\yarn_prefix\bin` to system environment variable
- yarn start
- yarn dev
- Change path of `src/config/config.ts`
- Write all table's name(upper case, separated by new line) to `data/tables.txt`

## Rule

- All file has following rule
  - Controller file name must ends with `Controller.java`
- Overloaded function supported by parameter count, so same parameter count with different type not supported.

  ```java

  // Not supported
  public void doCall(int seq) {
    return this.doCall(seq.toString());
  }
  public void doCall(String seq) {
    System.out.println(seq);
  }

  // Supported
  public void doCall(int seq, String name) {
    return this.doCall(name);
  }
  public void doCall(String name) {
    System.out.println(name);
  }
  ```

- Get only first method when multiple methods exists in one semicolon.

- refid in include tag only references sql id in current file (not outer file)

  ```xml
  <sql id="myId">
  select * from USER
  </sql>

  <select id="selectAdult">
    <include refid="myId">
    WHERE AGE >= 19;
  </select>
  ```

- Only first public class treated in multiple class in one file and rest private class ignored.

- Cannot extract object name(table, view, function, procedure) which has `#` or `$` or enclosed with quote(`"`) from SQL.

- Quoted literal string removed when getting table name, but escaping quote only supports double quoute(`''`). Backslash(`\`) and literal quoting(`q'[I'm a boy]'`) not supported.

- `protected` modifier ignored.

## Run

Results will be like following after running `yarn dev` command.

`mapToTables.txt`:

```text
/api/manual/v1/BizBuilderWorkHandler: WB_WORK
/api/manual/v1/csManualTabHandler: WM_MANUALTAB,WM_MANUALTABCOMPONENT
```

`routes.txt`:

```text
mapping: /api/manual/v1/BizBuilderWorkHandler
 method: BizBuilderController.bizBuilderWorkHandler
 method: BizBuilderService.selectWorkList
    xml: BizBuilder.selectWorkList
  table: WB_WORK

mapping: /api/manual/v1/csManualTabHandler
 method: CsManualController.csManualTabHandler
 method: CSManualService.selectEditorTabListNoClobByMualIdx
    xml: Manual.selectEditorTabListNoClobByMualIdx
  table: WM_MANUALTAB
 method: CSManualService.selectEditorTabComponentByMualIdx
    xml: Manual.selectEditorTabComponentByMualIdx
  table: WM_MANUALTABCOMPONENT
```
