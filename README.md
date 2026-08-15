# 淘金币每日自动签到（Loon 脚本）

淘宝淘金币自动签到，运行在 iOS [Loon](https://www.loon0x.com/) 上。

- **两个脚本分工**：`taobao_cookie.js` 负责自动抓 Cookie，`taobao_taojinbi.js` 负责每日签到 + 金币数通知 + 额外任务
- **自动抓 Cookie**：无需手动复制粘贴，手机淘宝点一次即可自动采集
- **签到后通知当前金币数量**
- **额外赚金币任务**：支持配置任务表，抓包到「可领取/上报」类接口填进去即可执行
- 基于淘宝 H5 mtop 加密接口实现（`h5api.m.taobao.com`，`_m_h5_tk` 令牌 + MD5 签名），内置完整 token 自动获取与重试
- 支持多账号

> ⚠️ 本项目仅用于学习交流，请勿用于商业及非法用途。

## 文件说明

| 文件 | 类型 | 作用 |
| --- | --- | --- |
| `taobao_cookie.js` | http-request 脚本 | 拦截 `h5api.m.taobao.com` 请求，自动把 Cookie 存入 Loon `$persistentStore`，顺带记录你抓到的接口名 |
| `taobao_taojinbi.js` | cron 定时脚本 | 从 store 读 Cookie（可回退手动填写），执行签到、查询当前金币数、跑额外任务，汇总发通知 |
| `taobao-taojinbi.plugin` | Loon 插件 | 上面两者的打包，含抓 Cookie 规则 + 每天 8:30 定时 + MITM，订阅即用 |

## 原理

淘金币 H5 页面的数据接口走淘宝统一的 mtop 协议：
`sign = md5(token & t & appKey & data)`，其中 `token` 来自 `_m_h5_tk` cookie。
首次请求会返回 `FAIL_SYS_TOKEN_EMPTY` 并在 `Set-Cookie` 下发 `_m_h5_tk`，
脚本自动提取并带签名重试，即「token dance」。

脚本已实现：MD5（内嵌纯 JS）、签名构造、Cookie 管理、token dance、多账号、金币数提取、通知。

## 使用方法（两步）

### 第 1 步：订阅插件（自动抓 Cookie + 内置定时）

```
https://raw.githubusercontent.com/noodlespring/loon-taojinbi/main/taobao-taojinbi.plugin
```

添加：Loon → 配置 → **插件** → 添加插件 → 粘贴上面的 URL。
插件内置了 `[MITM] h5api.m.taobao.com`，打开 MITM 后：

1. 手机淘宝打开「**淘金币**」页面，**点一次签到**（或任意任务）
2. 此时 `taobao_cookie.js` 已自动抓到 Cookie 存入 store，并通知你「Cookie 已抓取」
3. 同时它会记录本次请求的 `api=` 接口名，供你第 2 步回填

> 多账号：切换淘宝账号后重新打开淘金币页面操作一次，store 里的 Cookie 会被覆盖为当前账号。

### 第 2 步：回填接口名（只填一次）

打开 Loon 里下载下来的 `taobao_taojinbi.js`，找到顶部 `CONFIG`：

- **`apiName`（必填）**：填签到接口名。如果第 1 步抓到了接口名，脚本会提示你；
  否则在 Loon 抓包记录里筛选 `h5api.m.taobao.com`，找**点签到那一下新增的 POST 请求**，
  把表单里的 `api=` 参数值复制过来（名称里通常含 `sign` / `checkin` / `daily` / `coin`）
- **`requestParams`（通常留空 `{}` 即可）**：如果签到请求的 `data=` 有参数，解码后填进来
- **`appKey` / `tInMilliseconds` / `jsv` / `type` / `dataType`（一般不用动）**：
  若接口报错，以抓包请求里的实际参数为准调整

填好后，定时任务（每天 8:30）就会自动签到，签到成功会推送通知并带上**当前金币数量**。

> 脚本直链（不想用插件时的替代）：
> - 抓 Cookie：`https://raw.githubusercontent.com/noodlespring/loon-taojinbi/main/taobao_cookie.js`（http-request）
> - 签到：`https://raw.githubusercontent.com/noodlespring/loon-taojinbi/main/taobao_taojinbi.js`（cron）

## 额外赚金币任务（可选项）

签到之外，淘金币还有一堆「浏览、逛店、看视频」任务。这些依赖真实 UI 操作，
**纯接口脚本做不了**；但其中有些是「完成任务后一键领取 / 上报」的接口，抓包到就能自动执行。

配置方法：在 `taobao_taojinbi.js` 的 `CONFIG.extraTasks` 里按格式加：

```js
extraTasks: [
  {
    name: '翻牌领金币',      // 任意名字，会出现在通知里
    api: 'mtop.xxxx.xxx',     // 抓包到的接口名（api= 参数值）
    params: { taskId: '123' }, // 请求体 data 解码后的对象，没有就留 {}
  },
],
```

- 签到完成后会依次执行 `extraTasks` 里的任务，结果一并进通知
- 抓到的 `api` 名如果被脚本存过（`taobao_cookie.js` 会自动记录），可以在 Loon 的
  `$persistentStore` 里查到参考值
- 通知里会区分「完成 / 已完成过 / 失败」

## 本地测试

```bash
node test.js
```

测试覆盖 MD5 与 Node crypto 对照、mtop 签名格式、Cookie 解析、token dance 全流程、
金币数提取、额外任务执行、账号解析。用 mock HTTP 层跑，不会真正请求淘宝。

## 风险与限制（务必阅读）

1. **接口会变**：淘金币 mtop 接口的 `api` 名、`appKey`、签名规则随淘宝版本可能变化，
   公开脚本存活期短。签名/token 机制在脚本里已固化，接口名和参数需要你在接口变更后
   重新抓包回填一次（`taobao_cookie.js` 会自动记录最新抓到的接口名，方便你对比）。
2. **风控**：淘宝对非真实设备环境调用有风控，数据中心 IP、异常 UA 可能被拦截或触发
   滑块验证。脚本检测到风控类返回会明确通知你，需要手动处理。
3. **逛店铺 / 看视频类任务做不了**：纯接口无法模拟真实 UI 浏览，`extraTasks` 只能跑
   「领取/上报」类接口，其余仍需手动。
4. **Cookie 有效期**：Cookie 过期后，在淘宝重新操作一次即可自动重新抓取。
5. **安全**：**不要把填了真实 Cookie 的脚本推到公开仓库**。仓库 `.gitignore`
   已忽略 `config.local.*`。

## 免责声明

本项目仅用于学习交流，请勿用于商业及非法用途。使用本项目产生的任何后果由使用者自行承担。
