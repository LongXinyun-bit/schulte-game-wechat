// app.js
App({
    onLaunch() {
        // 初始化全局数据
        const playerName = wx.getStorageSync('schulte_player_name') || '';
        const seenTutorial = wx.getStorageSync('schulte_seen_tutorial') || false;
        const records = wx.getStorageSync('schulte_records') || {};

        this.globalData = {
            playerName,
            seenTutorial,
            records
        };
    },

    globalData: {
        playerName: '',
        seenTutorial: false,
        records: {}
    }
})
