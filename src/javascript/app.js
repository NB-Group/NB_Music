// UIManager实例化和使用
const uiManager = new UIManager(settingManager, audioPlayer, playlistManager, favoriteManager, musicSearcher);

// 在初始化所有模块后，进行应用程序启动设置
document.addEventListener("DOMContentLoaded", () => {
    // 歌词播放器设置
    if (uiManager.lyricsPlayer) {
        uiManager.setLyricsPlayer(lyricsPlayer);
    } else {
        uiManager.setLyricsPlayer(new LyricsPlayer(audioPlayer.audio));
    }

    // 检查首次使用状态
    uiManager.checkFirstUse();
    
    // 默认显示首页
    uiManager.show(".homepage");
}); 