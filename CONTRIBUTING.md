# 维护与贡献约定

这是个人备考项目，但仍按可交接项目维护。

## 修改原则

1. 不凭空修补原始题库缺失内容；新增题目必须记录来源。
2. 不把 `sb_secret_`、`service_role`、数据库密码或连接字符串提交到项目。
3. `sb_publishable_` 是浏览器公开密钥，可以进入前端；数据安全必须由 Supabase RLS 保证。
4. 修改 `index.html`、`app.js`、`styles.css` 或 `supabase.js` 后递增资源查询版本和 Service Worker 缓存号。
5. 发布前必须运行静态校验和 UI 冒烟测试。
6. 任何影响学习记录结构的修改都要兼容旧版 `localStorage` 数据。

## 标准发布流程

```powershell
python tools\build_questions.py
python tools\validate_project.py
python tests\smoke_ui.py
python tools\build_release.py
```

在 Cloudflare 上传 `dist/ai-trainer-level3-web.zip`，再按 [测试与验收](docs/06_TESTING_AND_VALIDATION.md) 完成线上检查。

## Commit 建议

推荐使用明确的提交前缀：

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `test:` 测试
- `refactor:` 不改变行为的代码整理
- `chore:` 发布、构建和维护
