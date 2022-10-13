export type ValueType = 'Constructor' | 'Function' | 'Variable' | 'Literal' | 'Other';

// skipPlusComma is true to solve reorderBinaryOperator bug
export type FuncType = 'ModelAndViewWithParam';

export type FuncInfo = {
  type?: FuncType;
  find: (string | RegExp)[];
  replace: string | ((matches: RegExpExecArray[]) => string);
};
export const configFunc: FuncInfo[] = [
  {
    find: ['Util', '.', 'msgOnceAlertView'],
    replace: '/mobile/co/alert',
  },
  {
    // ConfigUtil.getString("server.host")
    find: ['ConfigUtil', '.', 'getString', '(', /^"([\w+.]+)"$/, ')'],
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{ConfigUtil.getString:${value}}`;
    },
  },
  {
    // HttpUtils.getProperty("web_root_secret")
    find: ['HttpUtils', '.', 'getProperty', '(', /^"([\w+.]+)"$/, ')'],
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{HttpUtils.getProperty:${value}}`;
    },
  },
  {
    // HttpUtils.getString("web_root_secret")
    find: ['HttpUtils', '.', 'getString', '(', /^"([\w+.]+)"$/, ')'],
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{HttpUtils.getString:${value}}`;
    },
  },
  {
    // request.getRequestURI()
    find: ['request', '.', 'getRequestURI', '(', ')'],
    replace: '{request.getRequestURI}',
  },
  {
    // request.getQueryString()
    find: ['request', '.', 'getQueryString', '(', ')'],
    replace: '{request.getQueryString}',
  },
  {
    // request.getParameter("prmoNo")
    find: ['request', '.', 'getParameter', '(', /^"([^"]+)"$/, ')'],
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{request.getParameter:${value}}`;
    },
  },
  {
    // HttpUtils.getString("hdplcc_promo_sectId","2718492")
    find: ['HttpUtils', '.', 'getString', '(', /^"([\w+.]+)"$/, /^"([\w+.]+)"$/, ')'],
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      const defaultValue = matches[1][1];
      return `{HttpUtils.getString:${value},${defaultValue}}`;
    },
  },
  {
    // ServletRequestUtils.getRequiredStringParameter(request, "EventNo")
    find: ['ServletRequestUtils', '.', 'getRequiredStringParameter', '(', /^\w+$/, /^"([\w+.]+)"$/, ')'],
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[1][1];
      return `{ServletRequestUtils.getRequiredStringParameter:${value}}`;
    },
  },
  {
    // WebLogicUtil.getSessionValue(request, "AdultAuthItemCode")
    find: ['WebLogicUtil', '.', 'getSessionValue', '(', /^\w+$/, /^"([\w+.]+)"$/, ')'],
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[1][1];
      return `{WebLogicUtil.getSessionValue:${value}}`;
    },
  },
  {
    // URLEncoder.encode(orgRefer, "UTF-8")
    find: ['URLEncoder', '.', 'encode', '(', /^\w+$/, /^"[^"]+"$/, ')'],
    replace: '',
  },
  {
    // Util.cleanXSS(returnUrl)
    find: ['Util', '.', 'cleanXSS', '(', /^\w+$/, ')'],
    replace: '',
  },
  {
    // return HttpUtils.sendEmail(model,customerService,emailAdr, ipAdr, emailSelfCertGbcd,id,custNo);
    find: ['HttpUtils', '.', 'sendEmail', '(', ')'],
    replace: '{MappingJacksonJsonView}',
  },
];

export const configConstructor: FuncInfo[] = [
  {
    // new ModelAndView()
    find: ['new', 'ModelAndView', '(', ')'],
    replace: '{EmptyModelAndView}',
  },
  {
    // new MappingJacksonJsonView()
    find: ['new', 'MappingJacksonJsonView', '(', ')'],
    replace: '{MappingJacksonJsonView}',
  },
  {
    // new ModelAndView("abc", model)
    type: 'ModelAndViewWithParam',
    find: ['new', 'ModelAndView', '('],
    replace: '',
  },
];

export const configVar: FuncInfo[] = [
  {
    // ACTION_NAME
    find: ['ACTION_NAME'],
    replace: '.do',
  },
  {
    // null
    find: ['null'],
    replace: '',
  },
];

export const ignores = new Set(['int', 'float', 'char', 'boolean', 'string', '(', ')', '+', ',']);
