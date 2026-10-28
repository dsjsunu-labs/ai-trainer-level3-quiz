# 安全与隐私

## 1. 数据范围

系统处理：

- 登录邮箱；
- 每道题的作答次数、正确/错误次数、最近答案；
- 收藏、错题巩固状态；
- 每日学习统计和模拟成绩；
- 本地番茄钟状态。

不要求姓名、身份证、手机号、社保、学历材料或支付信息。

## 2. 数据位置

- 本地副本：浏览器 `localStorage`。
- 云端副本：Supabase `user_progress.progress` JSONB。
- 静态题库：Cloudflare 公共静态文件。

## 3. 认证

- 使用 Supabase Magic Link 完成首次邮箱认证，支持邮箱和题库专用同步密码直接登录。
- 密码通过 HTTPS 交给 Supabase Auth；前端不会把密码写入 `localStorage`、学习进度或数据库进度表。
- 浏览器保存短期 Access Token 和 Refresh Token。
- Token 仅发送给对应 Supabase 项目。
- 退出登录会移除当前浏览器会话，但保留本地学习记录。

## 4. 授权

PostgreSQL 开启 RLS：

- `select`: 只能读取 `auth.uid() = user_id`；
- `insert`: 只能插入自己的 `user_id`；
- `update`: 只能更新自己的记录。

没有删除策略，因此网页客户端不能通过普通登录删除云端行。

## 5. 密钥分类

### 可以公开

- Supabase Project URL；
- `sb_publishable_...`；
- Cloudflare 公网网址。

### 绝不能公开

- 数据库密码；
- `service_role`；
- `sb_secret_...`；
- PostgreSQL 连接字符串；
- Cloudflare API Token。

校验脚本会扫描项目中是否出现高危关键字，但不能替代人工检查。

## 6. 威胁与缓解

| 风险 | 缓解 |
| --- | --- |
| 用户读取他人进度 | Supabase RLS |
| Publishable key 被复制 | 设计上允许公开，RLS限制权限 |
| 旧缓存运行旧代码 | 资源版本号 + 网络优先 Service Worker |
| XSS 注入题目文本 | 渲染前通过 `esc()` 转义 |
| 清空记录误操作 | 浏览器确认弹窗 |
| 离线数据丢失 | localStorage + 云同步 + JSON导出 |
| 登录邮件被滥用 | Supabase 邮件频率限制 |
| 同步密码泄露 | 至少 8 位、仅交给 Supabase Auth、页面不持久化明文 |

## 7. 隐私建议

- 不在题库或代码中写个人身份信息。
- 不要把 QQ 邮箱密码当作同步密码，建议为题库单独设置一个密码。
- 公共设备使用后退出登录并清除网站数据。
- 不把学习进度导出文件发到公开群聊。
- 定期检查 Supabase Users 中是否只有预期账号。
- 若项目公开给更多人，应补充正式隐私政策和数据删除入口。
