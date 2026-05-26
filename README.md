# Midnight Bluff Tavern — True 3D v4 Clean

原创 WebGL 3D 酒馆诈唬牌局原型，适合直接上传 GitHub Pages。

## v4 修复重点
- 放大牌桌，玩家距离同步拉开。
- 桌面道具重新排布：筹码改为整齐筹码堆，弃牌堆、左轮、蜡烛不再互相穿模。
- 粒子系统修复：烟雾只出现在火炉上方，灰尘变小，避免漂到玩家和桌面前面形成错位大球。
- 动画改为平滑正弦变化，不再每帧随机跳动。
- 继续保留原生 WebGL 真 3D，无外部 CDN。

## 上传方法
把 `index.html`、`style.css`、`game.js`、`README.md` 上传到 GitHub 仓库根目录，然后打开 GitHub Pages。刷新时建议 Ctrl + F5。
