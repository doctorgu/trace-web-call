export type ValueType = 'Constructor' | 'Function' | 'Variable' | 'Literal' | 'Other';

// skipPlusComma is true to solve reorderBinaryOperator bug
export type FuncType = 'ModelAndViewWithParam';

export type FuncInfo = {
  type?: FuncType;
  find: (string | RegExp)[];
  skipPlusComma: boolean;
  replace: string | ((matches: RegExpExecArray[]) => string);
};
export const configFunc: FuncInfo[] = [
  {
    find: ['Util', '.', 'msgOnceAlertView'],
    skipPlusComma: false,
    replace: '/mobile/co/alert',
  },
  {
    // ConfigUtil.getString("server.host")
    find: ['ConfigUtil', '.', 'getString', '(', /^"([\w+.]+)"$/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{ConfigUtil.getString:${value}}`;
    },
  },
  {
    // HttpUtils.getProperty("web_root_secret")
    find: ['HttpUtils', '.', 'getProperty', '(', /^"([\w+.]+)"$/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{HttpUtils.getProperty:${value}}`;
    },
  },
  {
    // HttpUtils.getString("web_root_secret")
    find: ['HttpUtils', '.', 'getString', '(', /^"([\w+.]+)"$/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{HttpUtils.getString:${value}}`;
    },
  },
  {
    // request.getRequestURI()
    find: ['request', '.', 'getRequestURI', '(', ')'],
    skipPlusComma: true,
    replace: '{request.getRequestURI}',
  },
  {
    // request.getQueryString()
    find: ['request', '.', 'getQueryString', '(', ')'],
    skipPlusComma: true,
    replace: '{request.getQueryString}',
  },
  {
    // request.getParameter("prmoNo")
    find: ['request', '.', 'getParameter', '(', /^"([^"]+)"$/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      return `{request.getParameter:${value}}`;
    },
  },
  {
    // HttpUtils.getString("hdplcc_promo_sectId","2718492")
    find: ['HttpUtils', '.', 'getString', '(', /^"([\w+.]+)"$/, /^"([\w+.]+)"$/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[0][1];
      const defaultValue = matches[1][1];
      return `{HttpUtils.getString:${value},${defaultValue}}`;
    },
  },
  {
    // ServletRequestUtils.getRequiredStringParameter(request, "EventNo")
    find: ['ServletRequestUtils', '.', 'getRequiredStringParameter', '(', /^\w+$/, /^"([\w+.]+)"$/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[1][1];
      return `{ServletRequestUtils.getRequiredStringParameter:${value}}`;
    },
  },
  {
    // WebLogicUtil.getSessionValue(request, "AdultAuthItemCode")
    find: ['WebLogicUtil', '.', 'getSessionValue', '(', /^\w+$/, /^"([\w+.]+)"$/, ')'],
    skipPlusComma: true,
    replace: (matches: RegExpExecArray[]): string => {
      const value = matches[1][1];
      return `{WebLogicUtil.getSessionValue:${value}}`;
    },
  },
  {
    // URLEncoder.encode(orgRefer, "UTF-8")
    find: ['URLEncoder', '.', 'encode', '(', /^\w+$/, /^"[^"]+"$/, ')'],
    skipPlusComma: true,
    replace: '',
  },
  {
    // Util.cleanXSS(returnUrl)
    find: ['Util', '.', 'cleanXSS', '(', /^\w+$/, ')'],
    skipPlusComma: true,
    replace: '',
  },
  {
    // return HttpUtils.sendEmail(model,customerService,emailAdr, ipAdr, emailSelfCertGbcd,id,custNo);
    find: ['HttpUtils', '.', 'sendEmail', '(', ')'],
    skipPlusComma: true,
    replace: '{MappingJacksonJsonView}',
  },
];

export const configConstructor: FuncInfo[] = [
  {
    // new ModelAndView()
    find: ['new', 'ModelAndView', '(', ')'],
    skipPlusComma: false,
    replace: '{EmptyModelAndView}',
  },
  {
    // new MappingJacksonJsonView()
    find: ['new', 'MappingJacksonJsonView', '(', ')'],
    skipPlusComma: false,
    replace: '{MappingJacksonJsonView}',
  },
  {
    // new ModelAndView("abc", model)
    type: 'ModelAndViewWithParam',
    find: ['new', 'ModelAndView', '('],
    skipPlusComma: false,
    replace: '',
  },
];

export const configVar: FuncInfo[] = [
  {
    // ACTION_NAME
    find: ['ACTION_NAME'],
    skipPlusComma: false,
    replace: '.do',
  },
  {
    // null
    find: ['null'],
    skipPlusComma: false,
    replace: '',
  },
];

export const ignores = new Set(['int', 'float', 'char', 'boolean', 'string', '(', ')', '+', ',']);
