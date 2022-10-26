# TraceWebCall

1. Log all tables, objects(view, function, procedure, package) jsp files used when API called through Mapping annotation in controller.
1. Log all routes from API to tables, objects, jsp.

## Initial setup

- yarn config set prefix `C:\yarn_prefix`
- yarn global add typescript
- yarn global add ts-node
- add `C:\yarn_prefix\bin` to system environment variable
- yarn start
- yarn dev
- Change path of `src/config/config.ts`
- Write all table's name(upper case, separated by new line) to `data/tables.txt`

## Exception

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

- `next` property ignored when 'springBatch', just reads all step.

## Run

Results will be inserted into following SQLite table after running `yarn start` command.

```text
ClassInfo
HeaderInfo
JspInfo
KeyInfo
MethodInfo
MethodInfoFind
ObjectAndTables
RouteJsp
RouteTable
Tables
XmlInfo
XmlNodeInfo
XmlNodeInfoFind
```
