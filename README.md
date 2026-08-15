# 淘金币每日自动签到（Loon 脚本）

淘宝淘金币每日自动签到脚本，运行在 iOS [Loon](https://www.loon0x.com/) 上。

- 只做「**每日签到**」这一个纯接口动作
- 基于淘宝 H5 mtop 加密接口实现（`h5api.m.taobao.com`，`_m_h5_tk` 令牌 + MD5 签名）
- 内置完整 token 自动获取与重试流程，无需你手动算签名
- 支持多账号，结果通过 Loon 通知推送

> ⚠️ 本项目仅用于学习交流，请勿用于商业及非法用途。

## 原理

淘金币 H5 页面（`market.m.taobao.com/app/tb-source-app/tz-wk`）的数据接口走淘宝统一的
mtop 协议：所有请求需要带上 `sign = md5(token & t & appKey & data)` 签名，
其中 `token` 来自 `_m_h5_tk` cookie。首次请求会拿到 `FAIL_SYS_TOKEN_EMPTY` 并在响应
`Set-Cookie` 里下发 `_m_h5_tk`，脚本自动提取并带签名重试，即「token dance」。

脚本已实现：MD5（内嵌纯 JS）、签名构造、Cookie 管理、token dance、多账号、结果通知。

## 订阅链接（Loon 插件）

Loon 支持用 URL 订阅插件，插件已内置每天 8:30 的定时任务，订阅后可自动拉取脚本更新：

```
https://raw.githubusercontent.com/noodlespring/loon-taojinbi/main/taobao-taojinbi.plugin
```

添加方式：Loon → 配置 → 插件 → 添加插件 → 粘贴上面的 URL。

> 脚本直链（不想用插件时，可在 Loon 里按 URL 添加脚本 / 手动下载编辑）：
> `https://raw.githubusercontent.com/noodlespring/loon-taojinbi/main/taobao_taojinbi.js`

> ⚠️ 通过插件订阅的脚本是远程共享代码，**不包含你的 Cookie**。订阅后请在 Loon 里
> 打开该脚本（Loon 会把下载的脚本缓存到本地，可编辑），把抓包得到的 Cookie 和
> API 名填入 `CONFIG` 后再启用定时任务，否则脚本只会提示你补填配置。

## 使用方法（三步）

### 第 1 步：抓包拿到 Cookie 和 API 名

1. Loon → 更多 → HTTP 抓包，打开「HTTP 抓包」开关，并确保抓包脚本生效；
   或者用 Loon 的 MITM（见下方配置片段，hostname 加 `h5api.m.taobao.com`）。
2. 手机淘宝打开「**淘金币**」页面，找到**签到**入口并点一次签到。
3. 回到 Loon 抓包记录，筛选 `h5api.m.taobao.com`，找到**签到对应的那个请求**：
   - 把该请求的 **`Cookie` 请求头整段复制** → 填入 `taobao_taojinbi.js` 的 `CONFIG.accounts[].cookie`
   - 把 URL / 表单里的 **`api=` 参数值**复制 → 填入 `CONFIG.apiName`
   - 把表单里的 **`appKey=` / `v=` / `jsv=` / `type=` / `dataType=`** 等参数值，对照填入对应配置
   - 把表单里的 **`data=` 参数解码后的 JSON**，填入 `CONFIG.requestParams`（签到请求体）

> 如果分不清哪个请求是「签到」，可以只看**点签到那一下**新增的那条 POST 请求。
> `api` 名称里通常含 `sign` / `checkin` / `daily` / `coin` 等字样。

### 第 2 步：填写配置

编辑 `taobao_taojinbi.js` 顶部 `CONFIG` 块：

- `apiName`：上一步抓到的接口名（必填）
- `requestParams`：上一步解码后的签到请求体（一般为空对象 `{}` 或几个活动 ID 字段）
- `accounts`：每个账号一行，`cookie` 填抓到的整段 Cookie（多账号复制账号块即可）
- `notify` / `notifyTitle`：通知开关与标题

> 如果签名用的时间戳精度、appKey 等与抓包不一致，脚本会报错或返回异常，
> 以抓包请求里实际参数为准调整 `tInMilliseconds` / `appKey`。

### 第 3 步：配置 Loon 定时任务

在 Loon 的配置文件里添加（或通过 App 界面）:

```
[Script]
http-request ^https://h5api\\.m\\.taobao\\.com/h5/ script-path=taobao_taojinbi.js, requires-body=true, tag=淘金币抓Cookie

[Cron]
30 8 * * * script-name=taobao_taojinbi.js

[MITM]
hostname = h5api.m.taobao.com
```

- `[Cron]` 里的 `30 8 * * *` 表示每天早上 8:30 执行，可自行调整
- `[Script]` 那行是抓包采集 Cookie 用的（可选项，帮你自动把最新 Cookie 存起来）；
  如果只填 Cookie 后手动触发，也可以不加

## 如何回填 API（细说）

脚本默认 `apiName: 'PLEASE_FILL_API_NAME'`，不会真的请求淘宝，而是直接提示你先填写。
请务必用第 1 步抓包到的真实值替换，否则脚本不会工作。

抓包时注意：

- `data` 参数是 URL 编码的 JSON，解码后才是 `requestParams`
- `sign` 不需要你填，脚本会自动算
- 不同账号 Cookie 不同，多个账号各填一份

## 本地测试

仓库自带 Node 单元测试（验证 MD5、签名、Cookie 解析、token dance 全流程）：

```bash
node test.js
```

测试用 mock 的 HTTP 层跑通流程，不会真正请求淘宝。

## 风险与限制（务必阅读）

1. **接口会变**：淘金币 mtop 接口的 `api` 名、`appKey`、签名规则随淘宝版本可能变化，
   公开脚本存活期短。签名/token 机制在脚本里已固化，接口名和参数需要你在接口变更后
   重新抓包回填一次。
2. **风控**：淘宝对非真实设备环境调用有风控，数据中心 IP、异常 UA 可能被拦截或触发
   滑块验证。脚本检测到风控类返回会明确通知你，需要手动处理。
3. **只做签到**：逛店铺、看视频等任务依赖真实 UI 操作，纯接口脚本无法完成，
   不在本项目范围内。
4. **Cookie 有效期**：Cookie 过期后需重新抓包填写。
5. **安全**：**不要把填了真实 Cookie 的脚本推到公开仓库**。仓库 `.gitignore`
   已忽略 `config.local.*`，你可以把本地配置存成 `config.local.js` 形式备份。

## 免责声明

本项目仅用于学习交流，请勿用于商业及非法用途。使用本项目产生的任何后果由使用者自行承担。
