# NB Music

![页面截图](image.png)
![GitHub license](https://img.shields.io/github/license/NB-Group/NB_Music)
![GitHub last commit](https://img.shields.io/github/last-commit/NB-Group/NB_Music)
## 简介
由NB-Group和User782Tec两名初中生开发的跨平台音乐播放器！无需VIP就能畅听全网音乐，因为我们直接从哔哩哔哩获取音频资源~ 
这里有：
- 全网音乐自由播放（包括其他平台要VIP的歌曲！）
- 一键导入B站收藏夹当歌单
- 智能歌词捕捉系统（自动匹配+手动补全双保险）

**初中生の黑科技宣言**：我们才不是只会做题的小可爱！用Electron+各大API，带你体验真正的白嫖听歌自由ψ(｀∇´)ψ

哦，对了！我们基于以下开源项目，感谢他们！
- [neteasecloudmusicapi](https://gitlab.com/Binaryify/neteasecloudmusicapi) 网易云API(Github仓库已经寄了)
- [BillBill Api Collect](https://github.com/SocialSisterYi/bilibili-API-collect) B站API
---

## 用户指南

### 下载
[Releases](https://github.com/NB-Group/NB_Music/releases)查看最新版本喵！
话说应该会有自动更新的，代码里写了的（）
### 特色功能说明书
**B站相关**  
- 我们从B站自动抓取最高音质版本（悄悄说：登录带大会员的账号才能听Hi-Res的QwQ）
- 收藏夹一键导入歌单（一点迁移成本都没有哦）

**歌词相关**
- 从网易云自动抓取歌词捏。  
- 自动匹配歌词的不对？你可以手动歌名（然后我们再去全网搜刮~记得在设置里打开哦）

**🛠️ 遇到问题怎么办？**  
- 歌曲加载失败→多点几次播放键（我们的重试机制超顽强！）
- 其他bug→对着屏幕说"修好它！"（然后重启应用就OK啦~才怪！要记得反馈给我们哦）
- 当然，修bug最重要的提交issues啦！

---

## 开发者文档

### 架构设计


#### 技术栈

- 🚀 Electron - 跨平台桌面应用开发框架
- 🎵 Html Dom API - 音频处理
- 🎨 原生 CSS - 界面样式
- 📦 Yarn - 包管理器
- 🔄 GitHub Actions - CI/CD
#### 核心模块
```bash
├──  icons/                       # 项目图标资源
├──  img/                         # 项目图像资源
├──  public/                      # 公共资源文件夹
├──  src/                         # 源代码文件夹
│   ├──  javascript/              # JavaScript文件
│   │   ├──  AudioPlayer.js       # 音频播放器功能
│   │   ├──  CacheManager.js      # 缓存管理器
│   │   ├──  FavoriteManager.js   # 收藏管理器
│   │   ├──  LoginManager.js      # 登录管理器
│   │   ├──  LyricsPlayer.js      # 歌词播放器
│   │   ├──  MusicSearcher.js     # 音乐搜索器
│   │   ├──  MusiclistManager.js  # 歌单管理器
│   │   ├──  PlaylistManager.js   # 播放列表管理器
│   │   ├──  SettingManager.js    # 设置管理器
│   │   ├──  UIManager.js         # UI管理器
│   │   ├──  UpdateManager.js     # 更新管理器
│   ├──  main.html                # 主要HTML文件
│   ├──  main.js                  # 主要JavaScript文件
│   ├──  script.js                # 辅助脚本
│   ├──  splash.html              # 启动画面HTML
│   ├──  styles/                  # 样式文件夹
│   │   ├──  base.css             # 基础样式
│   │   ├──  components/          # 组件样式
│   │   │   ├──  animations.css   # 动画样式
│   │   │   ├──  controls.css     # 控件样式
│   │   │   ├──  dialogs.css      # 对话框样式
│   │   │   ├──  lyrics.css       # 歌词样式
│   │   │   ├──  musiclist.css    # 歌单样式
│   │   │   ├──  notifications.css # 通知样式
│   │   │   ├──  player.css       # 播放器样式
│   │   │   ├──  settings.css     # 设置样式
│   │   │   ├──  sidebar.css      # 侧边栏样式
│   │   │   ├──  song.css         # 歌曲样式
│   │   │   ├──  titlebar.css     # 标题栏样式
│   │   ├──  index.css            # 首页样式
│   │   ├──  utilities.css        # 辅助样式
│   │   ├──  variables.css        # 变量样式
│   ├──  utils.js                 # 工具函数

```

#### 数据流向
```mermaid
graph TD
    A[用户操作] --> B{事件中心}
    
    %% 核心播放控制流
    B --> C[AudioPlayer]
    C -->|播放状态| D[LyricsPlayer]
    C -->|进度同步| E[视频背景]
    
    %% 播放列表管理流
    B --> F[PlaylistManager]
    F -->|歌单更新| G[MusiclistManager]
    G -->|持久化| H[localStorage]
    
    %% 搜索与缓存流
    I[B站API] -->|音频/视频链接| J[MusicSearcher]
    J -->|URL缓存| K[CacheManager]
    K -->|过期检查| F
    
    %% UI更新流
    F -->|播放状态| L[UIManager]
    L -->|界面更新| M[DOM]
    
    %% 收藏管理流
    B --> N[FavoriteManager]
    N -->|收藏同步| H
    
    %% 设置管理流
    O[SettingManager] -->|配置| F
    O -->|事件处理| L

    %% 状态保存流
    F -->|播放进度| H
    C -->|当前时间| H
```

### 贡献指南
1. 克隆仓库后执行 `yarn install --magic`（开玩笑的，正常install就好）
2. 调试主进程：`yarn debug`
3. 直接运行: `yarn run run`
4. 打包: `yarn build`
5. 代码规范：
   - 一定要组件化哦！面向对象启动！
   - 用yarn！
   - 记得用prettier格式化一遍，用eslint检查一遍喵
   - 其它没啥，代码合理即可。
   - 求大佬PR（雾）
6. 提PR时请附上猫耳表情包以通过审核（大雾）

---

**版权说明**  
开源协议：[GPL-3.0](LICENSE) 
开发团队：NB-Group和User782Tec这两名初中生（作业没写完也要写代码的传说！）（其实我们成绩都很好的啦）

尽管我们代码开源，但我们仍受《中华人民共和国著作权法》的保护。
禁止一切使用我们源代码的商业行为，包括但不限于，打包售卖、未经允许的搬运等。
（上次我们的Win12就被倒卖源码了QwQ）
如果用于学习交流，那么请便，但是务必标注作者和项目链接哦。

其它条款请见 [GPL-3.0](LICENSE) 协议文本。