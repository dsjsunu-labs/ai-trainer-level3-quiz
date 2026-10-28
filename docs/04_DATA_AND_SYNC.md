# 数据结构与同步机制

## 1. 本地存储键

| 键 | 内容 |
| --- | --- |
| `ai-trainer-level3-progress-v1` | 题目进度、每日统计、顺序位置、考试记录 |
| `ai-trainer-supabase-auth-v1` | Supabase 登录会话 |
| `ai-trainer-pomodoro-v1` | 番茄钟状态 |

## 2. 学习状态结构

简化示例：

```json
{
  "questions": {
    "single-1": {
      "attempts": 3,
      "correct": 2,
      "wrong": 1,
      "wrongStreak": 0,
      "recoveryStreak": 2,
      "favorite": true,
      "lastAnswer": ["A"],
      "lastAt": 1788140000000
    }
  },
  "days": {
    "2026-08-31": { "attempts": 20, "correct": 16 }
  },
  "lastSequence": 35,
  "exams": []
}
```

## 3. 云端表

Supabase 表 `public.user_progress`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | UUID 主键 | 对应 `auth.users.id` |
| `progress` | JSONB | 整份学习状态 |
| `updated_at` | timestamptz | 最近上传时间 |

每个账号只有一行，使用 upsert 更新。

## 4. RLS 权限

行级安全规则要求：

```sql
auth.uid() = user_id
```

登录用户只能查询、插入和更新自己的记录。匿名用户没有权限。完整 SQL 见 `docs/sql/supabase_setup.sql`。

## 5. 同步触发

- 登录成功后立即同步。
- 每次本地保存后约 900ms 自动同步。
- 浏览器触发 `online` 事件时同步。
- 用户在登录弹窗点击“立即同步”。

### iPhone 主屏幕版登录

iOS 可能把 Safari 和“添加到主屏幕”的网页 App 作为两套独立存储，因此 Safari 的登录状态不一定自动进入主屏幕版。项目提供同步密码作为稳定入口：

1. 在 Safari 通过邮件链接完成首次认证。
2. 打开绿色“已同步”，设置至少 8 位的同步密码。
3. 回到主屏幕版，填写同一邮箱和同步密码，点击“直接登录并同步”。

同步密码属于题库的 Supabase 账号，不是 QQ 邮箱密码。密码通过 HTTPS 直接交给 Supabase Auth 验证，项目页面不将密码写入 `localStorage` 或学习记录。

## 6. 合并策略

当前采用可解释的本地/云端合并：

- 题目集合取并集。
- `attempts/correct/wrong` 取两端最大值。
- 最近答案、连续错误和巩固次数取 `lastAt` 更新的一端。
- 收藏状态取最近更新的一端。
- 每日统计取最大值。
- 模拟考试按时间戳去重并保留最近 20 次。
- 顺序练习位置取较大值。

合并完成后同时写回本地和云端。

## 7. 冲突限制

该方案适合“主要在一台设备刷，偶尔换设备”的个人场景，但不是严格的 CRDT：

- 两台离线设备从相同次数同时各答一道题，恢复网络后取最大值，可能少计一次。
- 两台设备同时更改收藏，以更晚的 `lastAt` 为准。
- 设备系统时间严重错误会影响最近修改判断。

如果以后要求强一致，应把每次作答保存为不可变事件表，再由数据库聚合，而不是同步整份 JSON。

## 8. 离线可靠性

- 未联网作答会立即写到当前浏览器。
- 不要在尚未同步时清除网站数据、卸载主屏幕 PWA 或更换浏览器。
- VPN 打开后再答一道题会触发同步；最稳妥方式是点击“立即同步”并等待成功提示。
- 导出 JSON 是额外的人工备份通道。
