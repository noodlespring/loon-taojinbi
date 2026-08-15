/**
 * 淘金币每日自动签到（Loon 脚本）
 *
 * 说明：
 *  淘宝淘金币 H5 页面（market.m.taobao.com/app/tb-source-app/tz-wk）走的是
 *  mtop 加密接口（h5api.m.taobao.com/h5/{api}），接口采用
 *  _m_h5_tk 令牌 + MD5 签名。本脚本实现了完整的令牌获取与签名流程，
 *  只需你提供抓包得到的账号 Cookie 即可。
 *
 * 使用方法（详见 README.md）：
 *  1. Loon 开启「HTTP 抓包 / MITM」，hostname 加入 h5api.m.taobao.com
 *  2. 手机淘宝打开「淘金币」页面，做一次签到
 *  3. 抓取 h5api.m.taobao.com 的请求，把请求 Cookie 填到下方 CONFIG.accounts
 *  4. 抓取请求里 api= 的参数值，填到 CONFIG.apiName（见 README 的「如何回填 API」）
 *  5. Loon 添加 Cron 定时任务 + MITM hostname（见 README 配置片段）
 *
 * 注意：
 *  - 仅实现「每日签到」，逛店铺 / 看视频等 UI 类任务无法用纯接口完成
 *  - 请勿把填了真实 Cookie 的脚本提交到 GitHub（.gitignore 已忽略 config.local.*）
 *
 * Loon 定时任务示例（配置片段见 README）：
 *  [Cron]
 *  30 8 * * * script-name=taobao_taojinbi.js
 */

// ============================================================
// 配置区：使用前请填写以下内容
// ============================================================
const CONFIG = {
  // 【必填】淘金币每日签到的 mtop API 名称
  // 示例：'mtop.taobao.jinbi.dailySign'
  // ⚠️ 请务必用 Loon 抓包后回填真实值，见 README「如何回填 API」
  apiName: 'PLEASE_FILL_API_NAME',

  // mtop appKey（淘金币 H5 页面常用值，抓包请求里的 appKey= 参数为准）
  appKey: '12574478',

  // 签名时间戳精度：true=毫秒(13位) false=秒(10位)（以抓包请求的 t= 为准）
  tInMilliseconds: true,

  // 接口版本（抓包请求里的 v= 参数，一般固定 1.0）
  apiVersion: '1.0',

  // 接口 JS 版本（抓包请求里的 jsv= 参数）
  jsv: '2.4.8',

  // 返回类型（抓包请求里的 type= / dataType= 参数）
  type: 'originaljson',
  dataType: 'json',

  // 通用请求头
  headers: {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47(0x18002f2d) NetType/WIFI Language/zh_CN',
    'Referer': 'https://market.m.taobao.com/app/tb-source-app/tz-wk/index.html',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  },

  // 签到接口请求体参数（抓包请求里的 data= 参数解码后的 JSON 对象）
  // ⚠️ 同样需要抓包回填，见 README「如何回填 API」
  requestParams: {},

  // 【必填】账号列表：每个账号填一次抓包 Cookie
  // 从抓包请求的 Cookie 头复制整段粘贴即可（用分号/空格分隔的 name=value 均可）
  accounts: [
    {
      name: '账号1',
      cookie:
        'unb=PLEASE_FILL; cookie2=PLEASE_FILL; _tb_token_=PLEASE_FILL; _m_h5_tk=PLEASE_FILL; _m_h5_tk_enc=PLEASE_FILL; isg=PLEASE_FILL',
    },
    // { name: '账号2', cookie: '...' },
  ],

  // 是否发送通知
  notify: true,
  // 通知标题
  notifyTitle: '淘金币签到',
};

// ============================================================
// 纯 JS MD5 实现（Loon 无内置 crypto，故内嵌；Paul Johnston 算法）
// ============================================================
function md5(string) {
  function RotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function AddUnsigned(lX, lY) {
    var lX4, lY4, lX8, lY8, lResult;
    lX8 = lX & 0x80000000;
    lY8 = lY & 0x80000000;
    lX4 = lX & 0x40000000;
    lY4 = lY & 0x40000000;
    lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  }
  function F(x, y, z) { return (x & y) | (~x & z); }
  function G(x, y, z) { return (x & z) | (y & ~z); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | ~z); }
  function FF(a, b, c, d, x, s, ac) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function GG(a, b, c, d, x, s, ac) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function HH(a, b, c, d, x, s, ac) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function II(a, b, c, d, x, s, ac) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function ConvertToWordArray(string) {
    var lWordCount, lMessageLength = string.length;
    var lNumberOfWords_temp1 = lMessageLength + 8;
    var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    var lWordArray = Array(lNumberOfWords - 1);
    var lBytePosition = 0, lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition);
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function WordToHex(lValue) {
    var WordToHexValue = '', WordToHexValue_temp = '', lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue_temp = '0' + lByte.toString(16);
      WordToHexValue += WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }
  function utf8Encode(string) {
    string = string.replace(/\r\n/g, '\n');
    var utftext = '';
    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n);
      if (c < 128) utftext += String.fromCharCode(c);
      else if (c > 127 && c < 2048) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  }
  var x = [];
  var k, AA, BB, CC, DD, a, b, c, d;
  var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  string = utf8Encode(string);
  x = ConvertToWordArray(string);
  a = 0x67452301; b = 0xefcdab89; c = 0x98badcfe; d = 0x10325476;
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
    b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
    d = GG(d, a, b, c, x[k + 10], S22, 0x02441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
    a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x04881d05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
    a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
    b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
    d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
    d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
    b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);
    a = AddUnsigned(a, AA);
    b = AddUnsigned(b, BB);
    c = AddUnsigned(c, CC);
    d = AddUnsigned(d, DD);
  }
  return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase();
}

// ============================================================
// 工具函数
// ============================================================

// 解析 Set-Cookie 头（兼容多段/数组），返回 {name: value}
const COOKIE_ATTRS = new Set([
  'expires', 'path', 'domain', 'max-age', 'samesite', 'secure', 'httponly',
  'priority', 'partitioned', 'version', 'comment',
]);
function parseCookieHeader(headerValue) {
  const jar = {};
  if (!headerValue) return jar;
  const list = Array.isArray(headerValue) ? headerValue : [headerValue];
  list.forEach((chunk) => {
    // 一条 Set-Cookie 里可能有多个 name=value，逐个取，跳过属性名
    const re = /([^=;, \t\n]+)=([^;,]*)/g;
    let m;
    while ((m = re.exec(chunk)) !== null) {
      const name = m[1].trim();
      const value = m[2].trim();
      if (name && !COOKIE_ATTRS.has(name.toLowerCase())) jar[name] = value;
    }
  });
  return jar;
}

// 解析用户粘贴的 Cookie 字符串（分号/空格分隔的 name=value）
function parseCookieString(str) {
  const jar = {};
  if (!str) return jar;
  const re = /([^=;, \t\n]+)=([^;,]*)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const name = m[1].trim();
    const value = m[2].trim();
    if (name) jar[name] = value;
  }
  return jar;
}

// 把 jar 拼成 Cookie 请求头
function cookieJarToString(jar) {
  return Object.keys(jar)
    .map((k) => k + '=' + jar[k])
    .join('; ');
}

// 从 _m_h5_tk cookie 中提取签名令牌（下划线前的部分）
function extractToken(jar) {
  const raw = jar['_m_h5_tk'] || '';
  return raw.split('_')[0] || '';
}

function mergeJar(target, source) {
  Object.keys(source).forEach((k) => { target[k] = source[k]; });
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

// ============================================================
// mtop 签名与请求构造
// ============================================================

// mtop 签名规则：sign = md5(token & t & appKey & data)
// 其中 data 为请求体的原始 JSON 字符串（发送时再做 URL 编码）
function mtopSign(token, t, appKey, data) {
  return md5(token + '&' + t + '&' + appKey + '&' + data);
}

// 构造 mtop 请求的 form 表单体
function buildFormBody(apiName, requestData, token, appKey, cfg) {
  const rawData = JSON.stringify(requestData);
  const t = cfg.tInMilliseconds ? String(Date.now()) : String(Math.floor(Date.now() / 1000));
  const sign = mtopSign(token, t, appKey, rawData);
  return {
    rawData,
    t,
    sign,
    body:
      'data=' + encodeURIComponent(rawData) +
      '&appKey=' + appKey +
      '&t=' + t +
      '&sign=' + sign +
      '&api=' + apiName +
      '&v=' + cfg.apiVersion +
      '&type=' + cfg.type +
      '&dataType=' + cfg.dataType +
      '&jsv=' + cfg.jsv,
  };
}

// 提取 mtop 响应状态：ret[0]，如 "SUCCESS::调用成功"
function getRet(parsed) {
  if (!parsed || !Array.isArray(parsed.ret) || parsed.ret.length === 0) return '';
  return String(parsed.ret[0]);
}

function isSuccess(parsed) {
  return /^SUCCESS/i.test(getRet(parsed));
}

// 需要重新获取令牌（首次请求没有 _m_h5_tk 时的典型返回）
function isTokenError(parsed) {
  const ret = getRet(parsed);
  return /TOKEN_EMPTY|TOKEN_EXPIRED|令牌为空|令牌已过期|FAIL_SYS_TOKEN/i.test(ret);
}

// 是否命中风控（需要人工处理的场景）
function isRiskControl(parsed) {
  const ret = getRet(parsed);
  return /USER_VALIDATE|验证|滑块|安全验证|risk|风控/i.test(ret);
}

// ============================================================
// HTTP 层（Loon $httpClient）
// ============================================================

const http = typeof $httpClient !== 'undefined' ? $httpClient : null;

function httpRequest(httpImpl, method, url, params) {
  return new Promise((resolve, reject) => {
    httpImpl[method](url, params, (error, response, data) => {
      if (error) reject(error);
      else resolve({ response, body: data });
    });
  });
}

// ============================================================
// 单账号会话：cookie jar + 令牌自动获取 + 签名重试
// ============================================================

function createSession(baseCookieString, cfg) {
  const jar = parseCookieString(baseCookieString);
  let token = extractToken(jar);
  return { jar, token, cfg };
}

// 发起一次 mtop 请求（带签名），并把响应 Set-Cookie 合并进 jar
async function mtopRequest(httpImpl, session, apiName, requestData) {
  const { jar, cfg } = session;
  const built = buildFormBody(apiName, requestData, session.token, cfg.appKey, cfg);
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'Cookie': cookieJarToString(jar),
  };
  Object.keys(cfg.headers).forEach((k) => { headers[k] = cfg.headers[k]; });

  const url = 'https://h5api.m.taobao.com/h5/' + apiName;
  const { response, body } = await httpRequest(httpImpl, 'post', url, {
    headers,
    body: built.body,
    timeout: 15000,
  });

  // 合并返回的 Set-Cookie，并刷新令牌
  if (response && response.headers) {
    const setCookies = response.headers['set-cookie'] || response.headers['Set-Cookie'] || '';
    mergeJar(jar, parseCookieHeader(setCookies));
    session.token = extractToken(jar);
  }
  return body;
}

// 带令牌获取与重试的 mtop 调用
async function mtopCall(httpImpl, session, apiName, requestData) {
  let body = await mtopRequest(httpImpl, session, apiName, requestData);
  let parsed = safeJsonParse(body);
  // 首次令牌为空：重试一次（此时 jar 已拿到新的 _m_h5_tk）
  if (parsed && isTokenError(parsed) && session.token) {
    body = await mtopRequest(httpImpl, session, apiName, requestData);
    parsed = safeJsonParse(body);
  }
  return { body, parsed };
}

// ============================================================
// 业务逻辑：每日签到 + 金币信息解析
// ============================================================

// 从响应 data 中尽力提取金币相关字段，找不到就返回空对象
function extractCoinInfo(parsed) {
  const data = parsed && parsed.data;
  if (!data || typeof data !== 'object') return {};
  const info = {};
  const keys = Object.keys(data);
  const coinKeys = keys.filter((k) => /coin|jinbi|gold|balance|total|count|value/i.test(k));
  coinKeys.forEach((k) => {
    const v = data[k];
    if (v === null || v === undefined) return;
    if (typeof v === 'object') {
      info[k] = JSON.stringify(v);
    } else {
      info[k] = String(v);
    }
  });
  return info;
}

// 签到单个账号，返回结果描述字符串
async function signInAccount(httpImpl, account, cfg) {
  const session = createSession(account.cookie, cfg);
  const { parsed } = await mtopCall(httpImpl, session, cfg.apiName, cfg.requestParams);

  if (!parsed) return account.name + '：响应解析失败（可能被风控拦截，需打开抓包看真实返回）';

  const ret = getRet(parsed);
  if (isSuccess(parsed)) {
    const info = extractCoinInfo(parsed);
    const coinText = Object.keys(info).length
      ? '（' + Object.keys(info).map((k) => k + '=' + info[k]).join(', ') + '）'
      : '';
    return account.name + '：签到成功' + coinText;
  }
  if (/签到|已领取|今日已/i.test(ret)) {
    return account.name + '：已签到/已领取（' + ret + '）';
  }
  if (isRiskControl(parsed)) {
    return account.name + '：触发风控验证，需手动处理（' + ret + '）';
  }
  return account.name + '：失败（' + ret + '）';
}

// ============================================================
// 主入口
// ============================================================

function notify(title, body) {
  if (CONFIG.notify && typeof $notification !== 'undefined') {
    $notification.post(title, '', body);
  }
}

function log(msg) {
  if (typeof console !== 'undefined' && console.log) console.log(msg);
  else if (typeof $log !== 'undefined') $log(msg);
}

async function main() {
  // 配置预检
  if (!CONFIG.apiName || /PLEASE_FILL/i.test(CONFIG.apiName)) {
    notify(CONFIG.notifyTitle, '请先填写 API 名称：在脚本 CONFIG.apiName 处回填抓包得到的接口名（见 README）');
    return;
  }
  const filled = CONFIG.accounts.filter(
    (a) => a.cookie && !/PLEASE_FILL/i.test(a.cookie)
  );
  if (filled.length === 0) {
    notify(CONFIG.notifyTitle, '请先填写账号 Cookie：在脚本 CONFIG.accounts 处回填（见 README）');
    return;
  }

  const lines = [];
  for (const account of filled) {
    try {
      const line = await signInAccount(http, account, CONFIG);
      lines.push(line);
      log(line);
    } catch (e) {
      const errLine = account.name + '：请求异常（' + (e && e.message ? e.message : String(e)) + '）';
      lines.push(errLine);
      log(errLine);
    }
  }

  notify(CONFIG.notifyTitle, lines.join('\n'));

  if (typeof $done !== 'undefined') $done();
  return lines;
}

// ============================================================
// 运行
// ============================================================
if (typeof $httpClient !== 'undefined') {
  // Loon 环境：直接执行
  main().catch((e) => {
    notify(CONFIG.notifyTitle, '脚本异常：' + (e && e.message ? e.message : String(e)));
    if (typeof $done !== 'undefined') $done();
  });
} else if (typeof module !== 'undefined' && module.exports) {
  // Node 环境：导出纯函数供 test.js 单测
  module.exports = {
    md5,
    mtopSign,
    buildFormBody,
    parseCookieHeader,
    parseCookieString,
    cookieJarToString,
    extractToken,
    createSession,
    mtopCall,
    signInAccount,
    CONFIG,
  };
}
