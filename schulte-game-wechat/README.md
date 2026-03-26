# 舒尔特方格微信小程序

本项目是从 Web 版 [Schulte Grid](file:///Users/a1-6/Desktop/1225/schulte-game) 转换而来的微信小程序版本。

## 功能特性
- **经典训练**：3x3 到 6x6 难度选择。
- **计时系统**：精确到毫秒的注意力竞技。
- **心理学评级**：根据成绩给出专业的心理学状态反馈。
- **双人 PK**：本地 1v1 极速对决模式。
- **数据存档**：记录每个难度的个人最佳成绩。
- **原生分享**：支持分享给微信好友。

## 开发指南

### 环境准备
1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 注册一个微信小程序账号（个人开发者免费）。

### 运行步骤
1. 打开微信开发者工具。
2. 选择 **导入项目**。
3. 目录选择 `schulte-game-wechat` 文件夹。
4. AppID 可以填你注册的小程序 ID，或者选“测试号”进行本地预览。

## 文件说明
- `app.json`: 全局配置
- `pages/index/`: 核心逻辑、样式和结构
- `project.config.json`: 开发者工具配置
