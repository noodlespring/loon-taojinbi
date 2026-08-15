/**
 * 本地单元测试（仅在 Node 环境运行，不参与 Loon 运行）
 *
 * 运行：node test.js
 *
 * 覆盖：
 *  1. md5 与 Node crypto 对照
 *  2. mtop 签名格式（确定性 + 与参考实现一致的 sign）
 *  3. Cookie 解析 / jar 合并 / 令牌提取
 *  4. mock $httpClient 跑通「token dance → 签名 → 签到成功」全流程
 */

const assert = require('assert');
const crypto = require('crypto');
const m = require('./taobao_taojinbi.js');

const { md5, mtopSign, buildFormBody, parseCookieHeader, parseCookieString, cookieJarToString, extractToken, createSession, mtopCall, signInAccount } = m;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS', name);
  } catch (e) {
    failed++;
    console.log('  FAIL', name, '->', e.message);
  }
}

console.log('== 1. MD5 与 Node crypto 对照 ==');
const md5Cases = ['', 'abc', '123456', 'token&1700000000000&12574478&{}', '中文UTF8测试', 'a'.repeat(1000)];
md5Cases.forEach((s, i) => {
  test('md5 case ' + i, () => {
    assert.strictEqual(md5(s), crypto.createHash('md5').update(s, 'utf8').digest('hex'));
  });
});

console.log('== 2. mtop 签名格式 ==');
test('sign = md5(token&t&appKey&data)', () => {
  const token = 'abc123', t = '1700000000000', appKey = '12574478', data = '{"a":1}';
  const expect = crypto.createHash('md5').update(token + '&' + t + '&' + appKey + '&' + data, 'utf8').digest('hex');
  assert.strictEqual(mtopSign(token, t, appKey, data), expect);
});
test('buildFormBody 字段齐全且 data 已 URL 编码', () => {
  const built = buildFormBody('mtop.test.api', { a: 1 }, 'tok', '12574478', {
    tInMilliseconds: true, apiVersion: '1.0', type: 'originaljson', dataType: 'json', jsv: '2.4.8',
  });
  assert.ok(built.body.includes('data=' + encodeURIComponent('{"a":1}')));
  assert.ok(built.body.includes('&appKey=12574478&'));
  assert.ok(built.body.includes('&api=mtop.test.api&'));
  assert.ok(built.body.includes('&v=1.0&'));
  assert.ok(built.body.includes('&type=originaljson&'));
  assert.ok(built.body.includes('&dataType=json&'));
  assert.ok(built.body.includes('&jsv=2.4.8'));
  assert.ok(/^[0-9]{13}$/.test(built.t)); // 毫秒 13 位
});

console.log('== 3. Cookie 解析 ==');
test('parseCookieHeader 支持多段与属性过滤', () => {
  const jar = parseCookieHeader('_m_h5_tk=tk123_1700000000000; path=/; domain=.taobao.com; HttpOnly; cookie2=1a2b3c; path=/');
  assert.strictEqual(jar['_m_h5_tk'], 'tk123_1700000000000');
  assert.strictEqual(jar['cookie2'], '1a2b3c');
  assert.strictEqual(jar['path'], undefined);
  assert.strictEqual(jar['HttpOnly'], undefined);
});
test('parseCookieString 解析粘贴的 Cookie 串', () => {
  const jar = parseCookieString('unb=abc; cookie2=def; _tb_token_=ghi; _m_h5_tk=tk1_ts');
  assert.strictEqual(jar.unb, 'abc');
  assert.strictEqual(jar.cookie2, 'def');
  assert.strictEqual(jar['_m_h5_tk'], 'tk1_ts');
});
test('extractToken 取下划线前部分', () => {
  assert.strictEqual(extractToken({ _m_h5_tk: 'tk123_1700000000000' }), 'tk123');
  assert.strictEqual(extractToken({}), '');
});

console.log('== 4. mock $httpClient token dance 全流程 ==');
function makeMockHttp(responses) {
  let call = 0;
  const captured = [];
  const http = {
    post(url, params, cb) {
      captured.push({ url, headers: params.headers, body: params.body });
      const r = responses[Math.min(call, responses.length - 1)];
      call++;
      cb(null, { status: r.status, headers: r.headers || {} }, r.body);
    },
    get(url, params, cb) { cb(null, { status: 404 }, '{}'); },
  };
  http.captured = captured;
  return http;
}

test('token dance：首次令牌为空 → 带 token 重试 → SUCCESS', async () => {
  // 第一次响应：FAIL_SYS_TOKEN_EMPTY + Set-Cookie 下发 _m_h5_tk
  // 第二次响应：SUCCESS，data 里带金币信息
  const mock = makeMockHttp([
    {
      status: 200,
      headers: { 'set-cookie': '_m_h5_tk=serverToken_1700000000000; path=/; domain=.taobao.com' },
      body: JSON.stringify({ ret: ['FAIL_SYS_TOKEN_EMPTY::令牌为空'], data: {} }),
    },
    {
      status: 200,
      body: JSON.stringify({ ret: ['SUCCESS::调用成功'], data: { coinSum: 30, balance: 12345 } }),
    },
  ]);

  const session = createSession('unb=u1; cookie2=c2; _tb_token_=t3', {
    appKey: '12574478', tInMilliseconds: true, apiVersion: '1.0', type: 'originaljson', dataType: 'json', jsv: '2.4.8', headers: {},
  });
  const { parsed } = await mtopCall(mock, session, 'mtop.taobao.jinbi.dailySign', { activityId: 1 });

  assert.strictEqual(mock.captured.length, 2, '应当发生两次请求');
  // 第一次请求：无 token，签名基于空 token
  assert.ok(!/serverToken/.test(mock.captured[0].body), '首次请求不应使用服务端下发的 token');
  // 第二次请求：带 token 签名，sign = md5(token&t&appKey&data)
  const body2 = mock.captured[1].body;
  assert.ok(body2.includes('sign='), '重试请求包含签名');
  assert.ok(/Cookie:?/.test(JSON.stringify(mock.captured[1].headers)), '重试请求带 Cookie');
  const t2 = /[?&]t=(\d+)/.exec(body2)[1];
  const expectSign = md5('serverToken&' + t2 + '&12574478&' + '{"activityId":1}');
  assert.ok(body2.includes('sign=' + expectSign), '签名串格式为 md5(token&t&appKey&data)，实际 sign=' + /sign=([0-9a-f]+)/.exec(body2)[1] + ' 期望 ' + expectSign);
  assert.ok(parsed && /SUCCESS/.test(parsed.ret[0]), '重试后成功');
  assert.strictEqual(session.token, 'serverToken', '会话令牌已更新');
});

test('signInAccount 成功路径返回签到成功描述', async () => {
  const mock = makeMockHttp([
    { status: 200, headers: { 'set-cookie': '_m_h5_tk=tk_1; path=/' }, body: JSON.stringify({ ret: ['FAIL_SYS_TOKEN_EMPTY::令牌为空'], data: {} }) },
    { status: 200, body: JSON.stringify({ ret: ['SUCCESS::调用成功'], data: { coin: 15, coinTotal: 8888 } }) },
  ]);
  const cfg = {
    apiName: 'mtop.test.api', requestParams: {}, appKey: '12574478',
    tInMilliseconds: true, apiVersion: '1.0', type: 'originaljson', dataType: 'json', jsv: '2.4.8', headers: {},
  };
  const line = await signInAccount(mock, { name: '账号1', cookie: 'unb=u1' }, cfg);
  assert.ok(line.includes('签到成功'), 'got: ' + line);
  assert.ok(line.includes('coin='), '包含金币字段');
});

test('signInAccount 已签到返回友好描述', async () => {
  const mock = makeMockHttp([
    { status: 200, headers: { 'set-cookie': '_m_h5_tk=tk_1; path=/' }, body: JSON.stringify({ ret: ['FAIL_SYS_TOKEN_EMPTY::令牌为空'], data: {} }) },
    { status: 200, body: JSON.stringify({ ret: ['FAIL_SYS_ALREADY_SIGN::今日已签到'], data: {} }) },
  ]);
  const cfg = { apiName: 'mtop.test.api', requestParams: {}, appKey: '12574478', tInMilliseconds: true, apiVersion: '1.0', type: 'originaljson', dataType: 'json', jsv: '2.4.8', headers: {} };
  const line = await signInAccount(mock, { name: '账号1', cookie: 'unb=u1' }, cfg);
  assert.ok(/已签到/.test(line), 'got: ' + line);
});

console.log();
console.log('passed=' + passed + ' failed=' + failed);
process.exit(failed ? 1 : 0);
