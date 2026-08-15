/**
 * 淘金币 Cookie 自动抓取（Loon http-request 脚本）
 *
 * 用途：
 *  拦截 h5api.m.taobao.com 的请求，自动把 Cookie 存入 Loon 的 $persistentStore，
 *  签到脚本（taobao_taojinbi.js）会从这里读取，无需再手动复制 Cookie。
 *
 * 配置（Loon 插件已内置，或手动在配置里加）：
 *  [Script]
 *  http-request ^https://h5api\.m\.taobao\.com/h5/ script-path=taobao_cookie.js, requires-body=true, tag=淘金币抓Cookie, enable=true
 *  [MITM]
 *  hostname = h5api.m.taobao.com
 *
 * 使用：
 *  1. 确保 Loon 开启了 MITM / HTTP 抓包，hostname 包含 h5api.m.taobao.com
 *  2. 手机淘宝打开「淘金币」页面，点一次签到或任意任务
 *  3. 脚本自动抓到 Cookie，并通知你「已抓取」
 *  4. 之后定时签到脚本会自动带上最新 Cookie
 *
 * 提示：
 *  抓到的 Cookie 是「当前登录账号」的。多账号时切换账号后重新操作一次即可覆盖。
 */

const STORE_KEY = 'taojinbi_cookie';
const API_STORE_KEY = 'taojinbi_api_name';

function getCookieFromHeaders(headers) {
  return headers['Cookie'] || headers['cookie'] || '';
}

function extractApiName(body, url) {
  // api 可能在 POST body 里（data 是 URL 编码的 JSON，api 是独立字段），也可能在 URL 里
  if (body) {
    const m = /[?&]api=([^&]*)/.exec(body);
    if (m) return decodeURIComponent(m[1]);
  }
  if (url) {
    const m = /\/h5\/([^?\/]+)/.exec(url);
    if (m) return m[1];
  }
  return '';
}

function main() {
  const headers = $request.headers || {};
  const cookie = getCookieFromHeaders(headers);
  const api = extractApiName($request.body || '', $request.url || '');

  if (!cookie) {
    $done({});
    return;
  }

  // 只保留与登录身份相关的核心 Cookie，减少体积
  const keep = ['unb', 'cookie2', '_tb_token_', '_m_h5_tk', '_m_h5_tk_enc', 'isg', 'sgcookie', 'tracknick', '_l_g_', 'cna', 'tfstk', '_cc_', 'uc1', 'lgc', 'x5sec'];
  const parts = cookie.split(/;\s*/);
  const kept = [];
  parts.forEach((p) => {
    const name = p.split('=')[0];
    if (keep.indexOf(name) !== -1) kept.push(p);
  });
  const finalCookie = kept.length ? kept.join('; ') : cookie;

  const isNew = ($persistentStore.read(STORE_KEY) || '') !== finalCookie;
  $persistentStore.write(finalCookie, STORE_KEY);

  if (api && api !== ($persistentStore.read(API_STORE_KEY) || '')) {
    $persistentStore.write(api, API_STORE_KEY);
  }

  if (isNew) {
    $notification.post(
      '淘金币',
      'Cookie 已抓取',
      (api ? '捕获接口：' + api + '\n' : '') + '可在 Loon 里手动运行签到脚本验证'
    );
  }

  // 放行请求，不改写
  $done({});
}

main();
