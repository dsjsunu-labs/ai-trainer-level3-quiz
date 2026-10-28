# 故障排查与复盘

## 1. 网站显示 0 道题

### 原因

Cloudflare Direct Upload 没有保留 ZIP 中的 `data/` 子目录，`/data/questions.js` 返回 404。

### 修复

- 将 `questions.js` 放到发布包根目录。
- `index.html` 直接加载 `questions.js`。
- 发布后访问 `/questions.js`，确认 HTTP 200。

## 2. 能看到新按钮，但点击没反应

### 原因

Service Worker 缓存了旧 `app.js`，新 `index.html` 和旧脚本混用。

### 修复

- 所有静态资源使用相同 `?v=N`。
- Service Worker 缓存号同步升级。
- 导航和静态资源采用联网优先。
- 使用无痕窗口检查。
- 必要时清除该网站数据后重新打开。

## 3. 双击本地启动没反应

### 原因

旧批处理先打开浏览器，后启动本地服务，浏览器在端口就绪前访问。

### 修复

`server.py` 先绑定端口，再延迟打开浏览器，并在窗口显示本机和局域网地址。

## 4. 手机不开 VPN 无法打开

`workers.dev` 和 Supabase 在中国大陆部分网络不稳定。这不是前端故障。

可使用：

- VPN 首次加载；
- 离线缓存日常刷题；
- VPN 打开后同步；
- 或以后迁移境内云服务。

## 5. `Email rate limit exceeded`

Supabase 免费默认邮件服务触发限额。

- 停止反复点击。
- 等待约一小时。
- 每台设备只发送一次登录邮件。
- 登录成功后不要主动退出或清除网站数据。

## 6. 邮件只有 Sign in，没有验证码

这是当前设计：使用默认 Magic Link 登录。Supabase 新界面要求自定义 SMTP 才能编辑模板，因此项目不依赖 6 位验证码。

## 7. 点击邮件后没有返回题库

检查 Supabase：

```text
Authentication → URL Configuration
Site URL = 网站根地址
Redirect URLs = 网站根地址/**
```

并确保在发起登录的同一设备/浏览器打开邮件链接。

## 8. 手机和电脑记录不一致

1. 两台设备确认都显示“已同步”。
2. 打开 VPN/可用网络。
3. 在记录较新的设备先点“立即同步”。
4. 在另一台设备再点“立即同步”。
5. 不要在两台离线设备同时大量作答后立刻互相覆盖。

### Safari 显示已同步，主屏幕版却未同步

这是 iOS 对 Safari 与主屏幕网页 App 的存储隔离，不是题库或云端记录损坏。

1. 在 Safari 已登录页面点击绿色“已同步”。
2. 设置并确认至少 8 位的同步密码。
3. 打开主屏幕版，点击“登录同步”。
4. 填写同一邮箱和刚设置的同步密码，点击“直接登录并同步”。

不要填写 QQ 邮箱密码，也不要为此反复发送认证邮件。

## 9. 番茄钟没有声音

- 检查手机静音和音量。
- 浏览器必须有过用户点击才能播放 Web Audio。
- iOS 后台和锁屏可能限制声音；重新进入页面会按实际结束时间更新。

## 10. 更新后仍是旧版

1. 打开 `/?v=<新版本>`。
2. 电脑 `Ctrl + F5`。
3. 无痕窗口验证线上是否已更新。
4. 开发者工具 → Application → Storage → Clear site data。
5. 删除旧主屏幕图标，Safari 刷新后重新添加。

## 11. 开了 VPN 还是提示连不上同步服务

这不是 VPN 故障。刷题网页本身是静态文件，能打开；同步走的是你自己配置的 Supabase 项目域名（见 `config.js`）。

先确认 `config.js` 里的 `url` 是否还能解析：

```text
在浏览器打开 <你的项目地址>/auth/v1/health
```

如果返回 404 / 无法解析，通常是免费项目被暂停或删除。

处理：

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)，看项目是否 Pause 或 Deleted。
2. 若只是暂停：Restore 后同步会恢复，`config.js` 不用改。
3. 若已删除：新建项目，执行 `docs/sql/supabase_setup.sql`，把新的 Project URL 和 publishable key 写进 `config.js`，再重新部署。
4. 各设备浏览器里的本地刷题记录还在；云端对不上之前，先不要清网站数据。