# NB Music API 文档

服务器由Python Flask编写。暂时由文件系统作为数据库。
NB Music 2.0 映射系统简介

映射，是指建立B站视频和网易云音乐id之间的关联所建立的映射。
映射储存在由@bugingxiaocai提供的服务器里。
同时可以通过映射访问人数统计出热门歌曲、新增映射统计出新增的歌曲等等。
作为映射系统的拓展，允许用户自定义和上传歌曲、修改歌曲的各种信息等。

映射系统可以有效的解决：
歌词货不对板
首页没东西显示
上传不了歌曲
等阿巴阿巴的问题
## 基础信息

- **Base URL**: `http://127.0.0.1:5000/v1`
- **认证方式**: Bearer Token (使用B站UID加密认证)
- **数据格式**: JSON

## 认证相关

### 1. 用户登录

**Endpoint**: `POST /auth/login`

**请求参数**:
```json
{
  "bilibili_uid": "string, required, B站用户UID",
  "token": "string, required, 加密的B站SESSDATA",
  "timestamp": "string, required, ISO8601格式时间戳"
}
```

服务器通过 SESSDATA 这 cookie 项，向https://api.bilibili.com/x/web-interface/nav发get请求，判断res["data"]["mid"]字段是否等于uid字段以鉴权。

**成功响应**:
```json
{
  "success": true,
  "data": {
    "session_token": "string, 会话token",
    "user_info": {
      "uid": "string, B站UID",
      "nickname": "string, 用户昵称",
      "avatar": "string, 头像URL"
    }
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "number, 错误码",
    "message": "string, 错误信息"
  }
}
```

## 映射管理

### 2. 获取映射列表

**Endpoint**: `GET /mappings`

**查询参数**:
- `page`: 页码 (默认1)
- `limit`: 每页数量 (默认20)
- `sort`: 排序方式 (可选: `newest`, `popular`, 默认`newest`) - **用于首页推荐**
- `search`: 搜索关键词 (可选)

**Headers**:
- `Authorization: Bearer <session_token>`

**成功响应**:
```json
{
  "success": true,
  "data": {
    "mappings": [
      {
        "id": "string, 映射ID",
        "bvid": "string, B站视频BV号",
        "songName": "string, 歌曲名称",
        "artist": "string, 艺术家",
        "cover": "string, 封面URL",
        "neteasecloudId": "string, 网易云歌曲ID",
        "uploader_uid": "string, 上传者UID",
        "play_count": "number, 播放次数",
        "created_at": "string, 创建时间ISO8601"
      }
    ],
    "total": "number, 总数",
    "page": "number, 当前页",
    "limit": "number, 每页数量"
  }
}
```

### 3. 创建映射

**Endpoint**: `POST /mappings`

**Headers**:
- `Authorization: Bearer <session_token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "bvid": "string, required, B站视频BV号",
  "songName": "string, required, 歌曲名称",
  "artist": "string, required, 艺术家",
  "cover": "string, optional, 封面URL",
  "neteasecloudId": "string, required, 网易云歌曲ID",
  "is_public": "boolean, optional, 是否公开，默认true"
}
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "id": "string, 新创建的映射ID",
    "created_at": "string, 创建时间ISO8601"
  }
}
```

### 4. 删除映射

**Endpoint**: `DELETE /mappings/{mapping_id}`

**Headers**:
- `Authorization: Bearer <session_token>`

**成功响应**:
```json
{
  "success": true,
  "data": {
    "deleted_id": "string, 被删除的映射ID"
  }
}
```

## 歌单管理

### 5. 获取用户歌单

**Endpoint**: `GET /playlists`

**查询参数**:
- `include_songs`: boolean, 是否包含歌曲列表 (默认false)

**Headers**:
- `Authorization: Bearer <session_token>`

**成功响应**:
```json
{
  "success": true,
  "data": {
    "playlists": [
      {
        "id": "string, 歌单ID",
        "name": "string, 歌单名称",
        "description": "string, 描述",
        "cover": "string, 封面URL",
        "song_count": "number, 歌曲数量",
        "created_at": "string, 创建时间ISO8601",
        "updated_at": "string, 更新时间ISO8601",
        "songs": [
          {
            "bvid": "string, B站视频BV号",
            "songName": "string, 歌曲名称",
            "artist": "string, 艺术家",
            "cover": "string, 封面URL",
            "neteasecloudId": "string, 网易云歌曲ID"
          }
        ] // 仅当include_songs=true时包含
      }
    ]
  }
}
```

### 6. 创建歌单

**Endpoint**: `POST /playlists`

**Headers**:
- `Authorization: Bearer <session_token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "name": "string, required, 歌单名称",
  "description": "string, optional, 描述",
  "cover": "string, optional, 封面URL",
  "songs": [
    {
      "bvid": "string, B站视频BV号",
      "neteasecloudId": "string, 网易云歌曲ID"
    }
  ] // optional, 初始歌曲列表
}
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "id": "string, 新创建的歌单ID",
    "created_at": "string, 创建时间ISO8601"
  }
}
```

### 7. 更新歌单歌曲

**Endpoint**: `PUT /playlists/{playlist_id}/songs`

**Headers**:
- `Authorization: Bearer <session_token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "action": "string, required, add|remove|replace",
  "songs": [
    {
      "bvid": "string, B站视频BV号",
      "neteasecloudId": "string, 网易云歌曲ID"
    }
  ]
}
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "updated_count": "number, 更新的歌曲数量"
  }
}
```

## 播放统计

### 8. 记录播放

**Endpoint**: `POST /play/record`

**Headers**:
- `Authorization: Bearer <session_token>`
- `Content-Type: application/json`

**请求体**:
```json
{
  "bvid": "string, required, B站视频BV号",
  "duration": "number, required, 播放时长(秒)",
  "song_id": "string, optional, 网易云歌曲ID",
  "playlist_id": "string, optional, 关联的歌单ID"
}
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "recorded": true
  }
}
```

## 前端开发注意事项

1. **搜索与获取歌曲信息**：
   - 服务器不提供搜索API，前端应直接调用各平台API进行搜索
   - 服务器只负责存储和提供映射关系
   - 参考`MusicSearcher.js`中的实现，前端可以直接使用其搜索逻辑

2. **推荐功能的替代方案 (首页)**：
   - **获取热门歌曲**: 使用 `GET /mappings?sort=popular&limit=10` (或根据需要调整 `limit`) 获取热门映射，用于首页“热门歌曲”板块。
   - **获取最新添加**: 使用 `GET /mappings?sort=newest&limit=10` (或根据需要调整 `limit`) 获取最新创建的映射，用于首页“最新添加”板块。
   - 获取艺术家分类 - 前端自行实现或未来扩展API。

## 错误码

| 代码 | 描述 |
|------|------|
| 400 | 错误的请求参数 |
| 401 | 未授权/认证失败 |
| 403 | 禁止访问(无权限) |
| 404 | 资源不存在 |
| 409 | 资源冲突(如映射已存在) |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

## 注意事项

1. 所有请求必须包含有效的`Authorization`头
2. 所有敏感数据在传输过程中必须加密
3. 用户只能修改/删除自己创建的映射和歌单
4. 频率限制: 每个端点可能有不同的请求频率限制
5. 所有时间戳使用ISO8601格式