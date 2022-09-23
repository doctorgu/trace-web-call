// skipPlusComma is true to solve reorderBinaryOperator bug
type FuncInfo = {
  find: (string | RegExp)[];
  skipPlusComma: boolean;
  replace: string | ((matches: RegExpExecArray[]) => string);
};
export const configFunc: FuncInfo[] = [
  {
    find: ['new', 'MappingJacksonJsonView', '(', ')'],
    skipPlusComma: false,
    replace: '{json}',
  },
  {
    find: ['Util', '.', 'msgOnceAlertView'],
    skipPlusComma: false,
    replace: '/mobile/co/alert',
  },
  {
    // ConfigUtil.getString("server.host")
    find: ['ConfigUtil', '.', 'getString', '(', /"([\w+.]+)"/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{config.${value}}`;
    },
  },
  {
    // ServletRequestUtils.getRequiredStringParameter(request, "EventNo")
    find: ['ServletRequestUtils', '.', 'getRequiredStringParameter', '(', /\w+/, /"([\w+.]+)"/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[1][1];
      return `{stringParameter.${value}}`;
    },
  },
];
