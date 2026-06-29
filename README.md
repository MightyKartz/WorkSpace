# Local Kitsu Lite

轻量级本地小团队资产和任务管理系统。它保留 Kitsu 类工具里最常用的资产表、标签搜索、成员认领和任务看板，但不引入数据库、Docker 或复杂制片流程。

适合在局域网内管理角色、场景、道具、参考文件、制作任务和小团队每日进度。元数据写入本地 JSON，上传文件保存到本地或 NAS 挂载目录。

## 主要功能

- 资产上传、预览和元数据编辑
- 母层级分类：角色、场景、道具或自定义分类
- 标签搜索和项目筛选
- 成员、项目和母层级管理
- 任务看板：待认领、进行中、待审核、已完成
- 当前人员一键认领任务
- NAS 数据目录配置
- 前端隐藏本机绝对路径，避免局域网页面暴露隐私

## 快速启动

```bash
npm start
```

本机访问：

```text
http://localhost:4173
```

局域网访问：

```text
http://服务器IP:4173
```

图文使用说明：

```text
http://localhost:4173/guide.html
```

## NAS 存储

默认数据保存在项目内的 `data/`。团队使用时建议把数据目录指向 NAS：

```bash
LOCAL_KITSU_DATA_DIR=/Volumes/YourNAS/studio-board npm start
```

目录结构：

```text
studio-board/
  db.json
  uploads/
```

## 配置项

```bash
PORT=4173 HOST=0.0.0.0 MAX_UPLOAD_MB=500 LOCAL_KITSU_DATA_DIR=/Volumes/YourNAS/studio-board npm start
```

- `PORT`: 服务端口，默认 `4173`
- `HOST`: 监听地址，默认 `0.0.0.0`
- `MAX_UPLOAD_MB`: 单次上传请求上限，默认 `200`
- `LOCAL_KITSU_DATA_DIR`: 数据和上传文件保存目录

## 开发检查

```bash
npm test
```

测试使用 Node 内置 test runner，覆盖上传、持久化和隐私字段防回归。

## 当前限制

JSON 单文件适合小团队低并发局域网使用。多人高频同时编辑、权限隔离、审片批注或审计日志开始变重要时，再升级到 SQLite 或完整数据库。
