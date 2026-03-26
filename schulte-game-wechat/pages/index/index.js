const app = getApp();

Page({
    data: {
        currentScreen: 'name', // name, intro, tutorial, start, game, result, pkSetup, pkResult
        playerName: '',
        playerNameInput: '',
        hasSeenTutorial: false,

        // 游戏设置
        gridSize: 4,
        difficulties: [
            { label: '初级', size: 3 },
            { label: '中级', size: 4 },
            { label: '高级', size: 5 },
            { label: '专家', size: 6 }
        ],

        // 游戏状态
        gameNumbers: [],
        currentNumber: 1,
        totalNumbers: 0,
        startTime: null,
        gameTimer: '00:00.000',
        timerLabel: '用时',
        elapsedTime: 0,
        isPaused: false,
        isPlaying: false,

        // 教程状态
        tutorialNumbers: [],
        tutorialTimer: '00:00.000',

        // 结果
        finalTime: '',
        finalDifficulty: '',
        finalRank: '',
        resultTitle: '',
        resultDescription: '',
        isNewRecord: false,

        // 排行榜
        recordsList: [],
        hasRecords: false,

        // PK模式
        pkPlayer1: '',
        pkPlayer2: '',
        pkState: {
            active: false,
            currentTurn: 1, // 1 or 2
            p1Time: 0,
            p2Time: 0
        },
        pkWinnerName: '',
        pkWinnerTitle: '',
        pkWinnerTime: '',
        pkLoserName: '',
        pkLoserTime: '',

        // 高级弹窗
        showHeroModal: false,

        // 庆祝特效
        showConfetti: false,
        confettiPieces: []
    },

    onLoad() {
        this.checkFirstTime();
    },

    onHide() {
        // 切后台自动暂停，职业级保护，防止作弊或后台耗电
        if (this.data.isPlaying && !this.data.isPaused) {
            this.togglePause();
        }
    },

    onUnload() {
        this.stopTimerSystem();
        if (this.tutorialTimerId) clearInterval(this.tutorialTimerId);
    },

    // ========== 启动逻辑优化 (符合合规要求) ==========
    checkFirstTime() {
        const playerName = wx.getStorageSync('schulte_player_name') || '挑战者';
        const seenTutorial = wx.getStorageSync('schulte_seen_tutorial');

        // 无论有没有昵称，都先进入功能区，不强迫授权/输入
        this.setData({
            playerName,
            hasSeenTutorial: seenTutorial === true,
            currentScreen: seenTutorial === true ? 'start' : 'intro',
            showHeroModal: seenTutorial !== true // 如果是全新用户，一进入就弹科普
        }, () => {
            if (seenTutorial === true) {
                this.loadBestRecords();
            }
        });
    },

    // ========== 输入处理 ==========
    onNameInput(e) {
        this.setData({ playerNameInput: e.detail.value });
    },

    onPKPlayer1Input(e) {
        this.setData({ pkPlayer1: e.detail.value });
    },

    onPKPlayer2Input(e) {
        this.setData({ pkPlayer2: e.detail.value });
    },

    // ========== 动作处理 ==========
    saveName() {
        const name = this.data.playerNameInput.trim();
        if (!name) {
            wx.showToast({ title: '请输入昵称', icon: 'none' });
            return;
        }

        wx.setStorageSync('schulte_player_name', name);
        this.setData({
            playerName: name,
            currentScreen: 'start'
        });
        this.loadBestRecords();
    },

    editName() {
        this.setData({
            playerNameInput: this.data.playerName === '挑战者' ? '' : this.data.playerName,
            currentScreen: 'name'
        });
    },

    cancelNameEdit() {
        this.setData({ currentScreen: 'start' });
    },

    startTrial() {
        this.setData({ currentScreen: 'tutorial' });
        this.initTutorial();
    },

    selectDifficulty(e) {
        const size = e.currentTarget.dataset.size;
        this.setData({ gridSize: size });
    },

    // ========== 计时器系统 (极致性能版) ==========
    startTimerSystem() {
        this.stopTimerSystem(); // 防止 timer 叠加导致卡死
        this.startTime = Date.now() - this.data.elapsedTime;

        // 性能革命：为了防止点击格子时卡顿，我们将游戏过程中的UI刷新率降低
        // 用户寻找数字时不需要看精确到毫秒的变动，这会占用大量主线程资源
        this.timerId = setInterval(() => {
            const now = Date.now();
            this.currentElapsedTime = now - this.startTime;

            // 降低到每 200ms 更新一次 UI（体感流畅，但大幅减少压力）
            this.setData({
                gameTimer: this.formatTimeSimple(this.currentElapsedTime)
            });
        }, 200);
    },

    stopTimerSystem() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    },

    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const milliseconds = ms % 1000;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    },

    // 简化版时间格式（只显示到0.1秒）
    formatTimeSimple(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const tenths = Math.floor((ms % 1000) / 100);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
    },

    // ========== 游戏逻辑 ==========
    startGame() {
        const total = this.data.gridSize * this.data.gridSize;
        const numbers = this.generateShuffledNumbers(total);

        // 初始化内存计时器，防止读取旧数据
        this.currentElapsedTime = 0;

        this.setData({
            currentScreen: 'game',
            isPlaying: true,
            isPaused: false,
            currentNumber: 1,
            totalNumbers: total,
            elapsedTime: 0,
            gameTimer: '00:00.000',
            gameNumbers: numbers.map(v => ({ value: v, found: false })),
            timerLabel: this.data.pkState.active
                ? `${this.data.pkState.currentTurn === 1 ? this.data.pkPlayer1 : this.data.pkPlayer2} 挑战中`
                : '用时'
        });

        this.startTimerSystem();
    },

    generateShuffledNumbers(count) {
        const arr = Array.from({ length: count }, (_, i) => i + 1);
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    handleCellClick(e) {
        if (!this.data.isPlaying || this.data.isPaused) return;

        const { index, number } = e.currentTarget.dataset;

        if (number === this.data.currentNumber) {
            // 极致优化：只更新必要的数据
            const nextNum = this.data.currentNumber + 1;
            const key = `gameNumbers[${index}].found`;

            // 单次setData，不等待回调
            this.setData({
                [key]: true,
                currentNumber: nextNum
            });

            if (nextNum > this.data.totalNumbers) {
                this.completeGame();
            }
        } else if (!this.data.gameNumbers[index].found) {
            // 错误点击：给予视觉反馈
            const key = `gameNumbers[${index}].wrong`;
            this.setData({ [key]: true });

            // 400ms 后自动清除错误状态（对应动画时长）
            setTimeout(() => {
                this.setData({ [key]: false });
            }, 400);
        }
    },

    togglePause() {
        if (this.data.isPaused) {
            this.startTimerSystem();
        } else {
            this.stopTimerSystem();
            // 暂停瞬间保存当前已用时间，防止继续时时间回退
            this.setData({
                elapsedTime: this.currentElapsedTime
            });
        }
        this.setData({ isPaused: !this.data.isPaused });
    },

    resetGame() {
        this.stopTimerSystem();
        this.startGame();
    },

    backToStart() {
        this.stopTimerSystem();
        this.setData({
            currentScreen: 'start',
            isPlaying: false,
            pkState: { ...this.data.pkState, active: false }
        }, () => {
            this.loadBestRecords();
        });
    },

    // ========== 教程逻辑 ==========
    initTutorial() {
        const numbers = this.generateShuffledNumbers(4); // 新手试玩改为 2x2 (4格)
        this.setData({
            tutorialNumbers: numbers.map(v => ({ value: v, found: false, wrong: false })),
            tutorialTimer: '00:00.0'
        });

        this.tutorialStartTime = Date.now();
        this.tutorialCurrentTime = 0;
        // 教程模式也实时更新UI，让用户感受节奏
        this.tutorialTimerId = setInterval(() => {
            const diff = Date.now() - this.tutorialStartTime;
            this.tutorialCurrentTime = diff;
            if (diff % 100 < 50) {
                this.setData({
                    tutorialTimer: this.formatTimeSimple(diff)
                });
            }
        }, 100);
    },

    handleTutorialClick(e) {
        const { index, number } = e.currentTarget.dataset;
        const currentNum = this.data.tutorialNumbers.filter(n => n.found).length + 1;

        if (number === currentNum) {
            const key = `tutorialNumbers[${index}].found`;
            this.setData({ [key]: true });

            if (currentNum === 4) { // 2x2 模式
                clearInterval(this.tutorialTimerId);
                this.setData({ hasSeenTutorial: true });
                wx.setStorageSync('schulte_seen_tutorial', true);

                wx.showModal({
                    title: '完成试玩!',
                    content: '你已经掌握了规则，开始正式挑战吧！',
                    showCancel: false,
                    success: () => {
                        this.setData({
                            currentScreen: 'start'
                        });
                        this.loadBestRecords();
                    }
                });
            }
        } else if (!this.data.tutorialNumbers[index].found) {
            // 试玩模式也加入错误反馈
            const key = `tutorialNumbers[${index}].wrong`;
            this.setData({ [key]: true });
            setTimeout(() => {
                this.setData({ [key]: false });
            }, 400);
        }
    },

    // ========== 完成逻辑 ==========
    completeGame() {
        this.stopTimerSystem();

        // 使用物理时间进行最终结算，比定时间隔更精确
        const ms = Date.now() - this.startTime;
        this.setData({
            isPlaying: false,
            elapsedTime: ms,
            gameTimer: this.formatTime(ms) // 强制同步 UI 计时器，确保结算视觉一致
        });

        // PK 模式逻辑
        if (this.data.pkState.active) {
            this.handlePKRoundEnd(ms);
            return;
        }

        const size = this.data.gridSize;
        const diff = `${size}×${size}`;
        const rankInfo = this.calculateRank(ms, size);

        const isNewRecord = this.saveRecord(ms, diff, rankInfo.rank);

        this.setData({
            currentScreen: 'result',
            finalTime: this.formatTime(ms),
            finalDifficulty: diff,
            finalRank: rankInfo.rank,
            resultTitle: rankInfo.title,
            resultDescription: rankInfo.description,
            isNewRecord: isNewRecord
        }, () => {
            // 如果是新纪录或者评级达到 S，触发撒花
            if (isNewRecord || rankInfo.rank.indexOf('S') !== -1) {
                this.triggerConfetti();
            }
            // 每次结算重置缓存，强制重新生成最新卡片
            this.shareImagePath = null;
            // 预生成分享图
            this.prepareShareCard();
        });
    },

    calculateRank(time, gridSize) {
        const seconds = time / 1000;

        // 针对不同难度设置不同的达标时间（单位：秒）
        // 阈值依次对应：S+, S, A, B
        const thresholds = {
            3: [3.5, 5.0, 8.0, 12.0],    // 3x3 比较快
            4: [8.0, 12.0, 20.0, 30.0],   // 4x4
            5: [18.0, 28.0, 45.0, 70.0],  // 5x5 难度陡增
            6: [35.0, 55.0, 90.0, 140.0]  // 6x6 视野非常广
        };

        const [sPlus, sLimit, aLimit, bLimit] = thresholds[gridSize] || thresholds[4];

        let rank = 'C';
        let title = '入门 · 脑雾散去中';
        let description = '刚开始训练，正在努力驱散注意力的涣散（脑雾）。';

        if (seconds < sPlus) {
            rank = 'S+';
            title = '超神 · 前额叶主宰';
            description = '大脑执行功能达到极致，前额叶皮层处于完全觉醒状态。';
        } else if (seconds < sLimit) {
            rank = 'S';
            title = '觉醒 · 多巴胺猎手';
            description = '专注力极高，大脑奖励机制（多巴胺）正全力运作。';
        } else if (seconds < aLimit) {
            rank = 'A';
            title = '精英 · 突触连接者';
            description = '神经反应速度快，神经突触信号传递非常高效。';
        } else if (seconds < bLimit) {
            rank = 'B';
            title = '进阶 · 神经元活跃';
            description = '大脑已被充分激活，正处于良好的活跃状态。';
        }

        return { rank, title, description };
    },

    // ========== 存档逻辑 ==========
    loadBestRecords() {
        const records = wx.getStorageSync('schulte_records') || {};
        const difficulties = ['3×3', '4×4', '5×5', '6×6'];
        const list = difficulties
            .filter(d => records[d])
            .map(d => ({
                difficulty: d,
                timeStr: this.formatTime(records[d].time),
                time: records[d].time
            }));

        this.setData({
            recordsList: list,
            hasRecords: list.length > 0
        });
    },

    saveRecord(time, difficulty, rank) {
        const records = wx.getStorageSync('schulte_records') || {};
        const current = records[difficulty];
        const isNewRecord = !current || time < current.time;

        if (isNewRecord) {
            records[difficulty] = {
                time,
                rank,
                date: new Date().toISOString()
            };
            wx.setStorageSync('schulte_records', records);
        }
        return isNewRecord;
    },

    // ========== PK 模式 ==========
    showPKSetup() {
        this.setData({ currentScreen: 'pkSetup' });
    },

    startPKMatch() {
        const p1 = this.data.pkPlayer1.trim() || '玩家1';
        const p2 = this.data.pkPlayer2.trim() || '玩家2';

        this.setData({
            pkPlayer1: p1,
            pkPlayer2: p2,
            pkState: {
                active: true,
                currentTurn: 1,
                p1Time: 0,
                p2Time: 0
            },
            gridSize: 3 // PK默认快速对决
        }, () => {
            this.startGame();
        });
    },

    handlePKRoundEnd(time) {
        if (this.data.pkState.currentTurn === 1) {
            this.setData({
                'pkState.p1Time': time,
                'pkState.currentTurn': 2
            }, () => {
                wx.showModal({
                    title: '第一回合结束',
                    content: `${this.data.pkPlayer1} 用时 ${this.formatTime(time)}。现在请 ${this.data.pkPlayer2} 准备！`,
                    showCancel: false,
                    success: () => this.startGame()
                });
            });
        } else {
            this.setData({ 'pkState.p2Time': time }, () => {
                this.showPKResult();
            });
        }
    },

    showPKResult() {
        const { p1Time, p2Time } = this.data.pkState;
        const p1Win = p1Time < p2Time;
        const winnerName = p1Win ? this.data.pkPlayer1 : this.data.pkPlayer2;
        const winnerTime = p1Win ? p1Time : p2Time;
        const loserName = p1Win ? this.data.pkPlayer2 : this.data.pkPlayer1;
        const loserTime = p1Win ? p2Time : p1Time;

        const rankInfo = this.calculateRank(winnerTime, this.data.gridSize);

        this.setData({
            currentScreen: 'pkResult',
            pkWinnerName: winnerName,
            pkWinnerTitle: rankInfo.title,
            pkWinnerTime: this.formatTime(winnerTime),
            pkLoserName: loserName,
            pkLoserTime: this.formatTime(loserTime)
        });
    },

    playAgain() {
        this.startGame();
    },

    closeHeroModal() {
        this.setData({ showHeroModal: false });
    },

    // ========== 庆祝特效 ==========
    triggerConfetti() {
        const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
        const pieces = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 2,
            angle: Math.random() * 360
        }));

        this.setData({
            showConfetti: true,
            confettiPieces: pieces
        });

        // 5秒后清除，保持性能
        setTimeout(() => {
            this.setData({ showConfetti: false, confettiPieces: [] });
        }, 5000);

        // 震动反馈
        wx.vibrateLong();
    },

    // ========== 分享图绘图逻辑 (视觉大升级版) ==========
    prepareShareCard() {
        const query = wx.createSelectorQuery();
        query.select('#shareCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0]) return;
                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');
                const isExcellent = this.data.finalRank.startsWith('S');

                const dpr = wx.getSystemInfoSync().pixelRatio;
                canvas.width = 750 * dpr;
                canvas.height = 650 * dpr; // 稍微加高一点，排版更舒展
                ctx.scale(dpr, dpr);

                // 1. 绘制深邃背景
                const bgGradient = ctx.createLinearGradient(0, 0, 750, 650);
                bgGradient.addColorStop(0, '#0F172A');
                bgGradient.addColorStop(1, '#111827');
                ctx.fillStyle = bgGradient;
                ctx.fillRect(0, 0, 750, 650);

                // 2. 绘制氛围光晕 (如果是好成绩，增加金/翠绿色光)
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const orbitGlow = ctx.createRadialGradient(500, 200, 50, 500, 200, 450);
                if (isExcellent) {
                    orbitGlow.addColorStop(0, 'rgba(245, 158, 11, 0.4)'); // 暖金色
                    orbitGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
                } else {
                    orbitGlow.addColorStop(0, 'rgba(139, 92, 246, 0.4)'); // 极客紫
                    orbitGlow.addColorStop(1, 'rgba(59, 130, 246, 0)');
                }
                ctx.fillStyle = orbitGlow;
                ctx.fillRect(0, 0, 750, 650);
                ctx.restore();

                // 3. 绘制顶部信息区（左用户名 + 右评级胶囊，互不遮挡）
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 36px sans-serif';
                ctx.fillText(`👑 ${this.data.playerName}`, 60, 80);

                ctx.fillStyle = '#94A3B8';
                ctx.font = '24px sans-serif';
                ctx.fillText('专注力训练 · 完成挑战', 60, 118);

                // 右上角评级胶囊标签（y=38~94，绝不进入卡片区）
                ctx.save();
                const lx = 555, ly = 38, lw = 140, lh = 56, lr = 28;
                ctx.fillStyle = isExcellent ? '#F59E0B' : '#8B5CF6';
                ctx.shadowBlur = 14;
                ctx.shadowColor = isExcellent ? 'rgba(245,158,11,0.6)' : 'rgba(139,92,246,0.6)';
                ctx.beginPath();
                ctx.moveTo(lx + lr, ly);
                ctx.arcTo(lx + lw, ly, lx + lw, ly + lh, lr);
                ctx.arcTo(lx + lw, ly + lh, lx, ly + lh, lr);
                ctx.arcTo(lx, ly + lh, lx, ly, lr);
                ctx.arcTo(lx, ly, lx + lw, ly, lr);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 30px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${this.data.finalRank} 级`, lx + lw / 2, ly + lh / 2);
                ctx.restore();

                // 4. 撒花 Emoji 装饰（贴边角落，不遮内容）
                ctx.textBaseline = 'alphabetic';
                ctx.textAlign = 'left';
                ctx.font = '38px serif';
                ctx.globalAlpha = 0.28;
                ctx.fillText('🎊', 618, 648);
                ctx.fillText('🌟', 25, 618);
                ctx.fillText('✨', 672, 172);
                ctx.globalAlpha = 1.0;
                // 5. 绘制成绩卡片主体（y=140，与顶部胶囊完全不重叠）
                const cardY = 140;
                ctx.save();
                ctx.shadowBlur = 40;
                ctx.shadowColor = 'rgba(0,0,0,0.4)';
                ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
                const r = 36, w = 670, h = 360, x = 40, y = cardY;
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + w, y, x + w, y + h, r);
                ctx.arcTo(x + w, y + h, x, y + h, r);
                ctx.arcTo(x, y + h, x, y, r);
                ctx.arcTo(x, y, x + w, y, r);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // 绘制用时数字（卡片内居中）
                ctx.textAlign = 'center';
                ctx.fillStyle = isExcellent ? '#FBBF24' : '#F8FAFC';
                ctx.font = 'bold 120px tabular-nums sans-serif';
                ctx.fillText(this.data.finalTime, 375, cardY + 168);

                // 绘制难度和称号
                ctx.fillStyle = isExcellent ? '#34D399' : '#60A5FA';
                ctx.font = 'bold 32px sans-serif';
                ctx.fillText(`🏆 ${this.data.finalDifficulty} · ${this.data.resultTitle}`, 375, cardY + 235);

                // 来源标注
                ctx.fillStyle = '#4B5563';
                ctx.font = '22px sans-serif';
                ctx.fillText(`舒尔特方格 · ${this.data.finalDifficulty} 模式`, 375, cardY + 282);

                // 7. 底部挑衅口号（直接、接地气、类鹅鸭杀风格）
                ctx.textAlign = 'center';
                ctx.fillStyle = '#CBD5E1';
                ctx.font = '26px sans-serif';
                ctx.fillText(`🎯 我在舒尔特拿了 ${this.data.finalRank} 级，你敢来吗？`, 375, 565);

                // 8. 导出图片
                setTimeout(() => {
                    wx.canvasToTempFilePath({
                        canvas: canvas,
                        success: (res) => {
                            this.shareImagePath = res.tempFilePath;
                        }
                    });
                }, 400);
            });
    },

    // 分享功能处理
    shareResult() {
        if (!this.shareImagePath) {
            wx.showLoading({ title: '正在准备荣誉卡片' });
            this.prepareShareCard();
            setTimeout(() => {
                wx.hideLoading();
                this.shareViaActionSheet();
            }, 1000);
        } else {
            this.shareViaActionSheet();
        }
    },

    shareViaActionSheet() {
        wx.showActionSheet({
            itemList: ['发送好友', '保存图片'],
            success: (res) => {
                if (res.tapIndex === 0) {
                    wx.showModal({
                        title: '分享提示',
                        content: '点击页面右上角“...”即可发送给好友',
                        showCancel: false,
                        confirmText: '知道啦'
                    });
                } else if (res.tapIndex === 1) {
                    wx.showLoading({ title: '保存中' });
                    wx.saveImageToPhotosAlbum({
                        filePath: this.shareImagePath,
                        success: () => {
                            wx.hideLoading();
                            wx.showToast({ title: '已存至相册' });
                        },
                        fail: () => {
                            wx.hideLoading();
                            wx.showModal({
                                title: '保存失败',
                                content: '请在小程序设置中开启“添加到相册”权限',
                                showCancel: false
                            });
                        }
                    });
                }
            }
        });
    },

    onShareAppMessage() {
        return {
            title: `我在舒尔特拿了个 ${this.data.finalRank} 级，用时 ${this.data.finalTime}！你能超过我吗？🎯`,
            path: '/pages/index/index',
            imageUrl: this.shareImagePath || ''
        };
    }
})
