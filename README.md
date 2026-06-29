# Local Kitsu Lite

本地小团队资产和任务板。无数据库依赖，元数据写入 JSON，上传文件落到本地或 NAS 挂载目录。

## 运行

```bash
npm start
```

浏览器打开 `http://localhost:4173`。局域网其他机器访问这台机器的 IP，例如 `http://192.168.1.20:4173`。

## NAS 存储

```bash
LOCAL_KITSU_DATA_DIR=/Volumes/YourNAS/studio-board npm start
```

目录结构：

```text
studio-board/
  db.json
  uploads/
```

## 可调项

```bash
PORT=4173 HOST=0.0.0.0 MAX_UPLOAD_MB=500 LOCAL_KITSU_DATA_DIR=/Volumes/YourNAS/studio-board npm start
```

ponytail: JSON 单文件适合小团队局域网；多人高频同时编辑开始冲突时，再换 SQLite。
