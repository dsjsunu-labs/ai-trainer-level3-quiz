# 部署与发布

## 1. 依赖服务

- Cloudflare Workers：静态网站和 HTTPS。
- Supabase：邮箱登录和 PostgreSQL。
- 两者当前使用 Free 套餐。

## 2. Supabase 初始化

### 建表和权限

在 Supabase SQL Editor 运行：

```text
docs/sql/supabase_setup.sql
```

成功提示应为 `Success. No rows returned`。

### 登录回跳

在 `Authentication → URL Configuration` 设置：

```text
Site URL
https://<你的站点地址>

Redirect URLs
https://<你的站点地址>/**
```

项目采用默认 Magic Link 完成首次邮件认证，不需要自定义 SMTP。认证后可在网页内为该 Supabase 账号设置同步密码，其他设备使用邮箱和同步密码直接登录。

### 前端配置

`config.js` 中填入：

- Project URL；
- `sb_publishable_...` 公钥。

Publishable key 本来就会公开给浏览器，不是数据库密码。绝不能放入前端：

- `sb_secret_...`
- `service_role`
- 数据库密码
- 连接字符串

## 3. 构建发布包

```powershell
python tools\validate_project.py
python tests\smoke_ui.py
python tools\build_release.py
```

发布包内文件必须全部位于 ZIP 根目录：

```text
index.html
styles.css
app.js
config.js
supabase.js
questions.js
service-worker.js
manifest.webmanifest
```

不要只上传 `data/questions.js`；Cloudflare 的直接上传流程曾经丢失该子目录，导致线上显示 0 道题。

## 4. Cloudflare Direct Upload

1. 打开 Cloudflare Worker 项目。
2. 点击“新部署”。
3. 上传 `dist/ai-trainer-level3-web.zip`。
4. 等待部署完成。
5. 访问 `/?v=<当前版本>`。
6. 强制刷新并执行线上验收。

## 5. 缓存版本

每次修改静态资源时同步更新：

- `index.html` 中 `?v=N`；
- `service-worker.js` 中 `ai-trainer-vN`；
- `service-worker.js` 的 `ASSETS` 查询版本。

校验脚本会检查三者一致。

## 6. 发布后验收

至少检查：

1. 首页显示 900 道题。
2. 登录同步按钮能打开。
3. 未登录弹窗显示“直接登录并同步”；已登录弹窗显示“设置 / 修改同步密码”。
4. 随机练习只选判断题后，实际题型都是判断。
5. 番茄钟能启动、暂停和悬浮。
6. `/questions.js` 返回 200，而不是 404。
7. 无痕窗口能加载最新版本。
8. 手机布局没有横向溢出。

## 7. 中国大陆网络

`workers.dev` 和 Supabase 属于境外免费服务，部分中国大陆移动网络无法直连。可选方案：

- 保持现状：首次加载和同步时使用 VPN，日常利用离线缓存。
- 给 Cloudflare 绑定自有域名：不保证大陆稳定。
- 迁移静态站和数据库到境内云服务：通常涉及实名、备案或费用。

## 8. 费用

当前未绑定付费方案时不会自动从本项目扣款。不要点击 `Upgrade to Pro` 或启用付费产品。平台免费额度和政策可能变化，定期在 Billing 页面确认。
