# 维护与版本升级

## 1. 更新题库

1. 修改上级目录的 `3级题目&答案.txt`。
2. 如补上单选 230，先调整 `tools/build_questions.py` 中的预期编号规则。
3. 运行：

```powershell
python tools\build_questions.py
python tools\validate_project.py
```

脚本会更新根目录的 `questions.js`，它同时是本地运行和 Cloudflare 发布所使用的唯一题库文件。

## 2. 修改前端

主要文件：

- 页面结构：`index.html`
- 样式：`styles.css`
- 业务逻辑：`app.js`
- 同步：`supabase.js`

修改后递增版本号，运行测试并更新 `CHANGELOG.md`。

## 3. 发布流程

```powershell
python tools\validate_project.py
python tests\smoke_ui.py
python tools\build_release.py
```

上传 `dist/ai-trainer-level3-web.zip` 后完成线上验收。

## 4. 数据结构升级

当前状态没有显式 schema version。新增字段时遵循：

- 所有读取都提供默认值；
- 不删除旧字段；
- `mergeStates()` 同时兼容旧/新对象；
- 上线前用一份旧 JSON 导入测试。

较大升级应增加 `schemaVersion` 和迁移函数。

## 5. Supabase 维护

- 定期检查项目状态是否被免费计划暂停。
- 检查 Authentication Users 和 API 日志。
- 检查 RLS 仍启用。
- 不随意创建匿名可写策略。
- 更换 Project URL/Publishable key 时更新 `config.js` 并递增缓存版本。

## 6. 备份

- 源码：建议初始化 Git 并推送到私人 GitHub/Gitee 仓库。
- 题库源文件：与项目一起备份。
- 学习进度：定期从“学习统计”导出 JSON。
- Supabase：免费计划备份策略有限，不应把它作为唯一备份。

## 7. 后续可演进方向

- 拆分 `app.js` 为 ES Modules。
- 增加真正的事件型同步，解决离线并发少计问题。
- 增加题目解析与人工纠错字段。
- 增加按考试大纲权重组卷。
- 增加每日复习计划和间隔重复算法。
- 增加境内镜像，降低大陆访问障碍。
- 添加图标资源，提升 PWA 安装体验。
