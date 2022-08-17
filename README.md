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

- All table is UPPER CASE in both `tables.txt` and SQL statement in xml
- All file has following rule
  - Controller file name must ends with `Controller.java`
  - Implementation file name must ends with `Impl.java`
- No overloaded function exists

## Run

Results will be like following after running `yarn dev` command.

`mapToTables.txt`:

```text
/api/manual/v1/BizBuilderWorkHandler: WB_WORK
/api/manual/v1/csManualTabHandler: WM_MANUALTAB,WM_MANUALTABCOMPONENT
```

`routes.txt`:

```text
mapping: GetMapping(/api/manual/v1/BizBuilderWorkHandler)
 method: BizBuilderController.bizBuilderWorkHandler
 method: BizBuilderService.selectWorkList
    xml: BizBuilder.selectWorkList
  table: WB_WORK

mapping: PostMapping(/api/manual/v1/csManualTabHandler)
 method: CsManualController.csManualTabHandler
 method: CSManualService.selectEditorTabListNoClobByMualIdx
    xml: Manual.selectEditorTabListNoClobByMualIdx
  table: WM_MANUALTAB
 method: CSManualService.selectEditorTabComponentByMualIdx
    xml: Manual.selectEditorTabComponentByMualIdx
  table: WM_MANUALTABCOMPONENT
```
