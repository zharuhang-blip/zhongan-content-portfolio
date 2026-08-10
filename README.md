# 查如杭 · 内容运营作品集

**线上地址（任何人可打开）：**  
https://zharuhang-blip.github.io/zhongan-content-portfolio/?v=20260810b

仓库：https://github.com/zharuhang-blip/zhongan-content-portfolio

本地可预览，也可部署成任何人都能打开的公开网址。

## 本地预览

```bash
cd /Users/charuhang/zhongan-content-portfolio
python3 -m http.server 5173
```

浏览器打开 http://localhost:5173

## 更新线上站点

改完代码后：

```bash
git add .
git commit -m "Update portfolio"
git push
```

推送到 `main` 后，GitHub Pages 会自动刷新（约 1 分钟）。
   - 等待 Actions 跑完
5. 地址一般为：  
   `https://你的用户名.github.io/zhongan-content-portfolio/`

项目里已放好自动部署文件：`.github/workflows/deploy-pages.yml`

## 添加视频（可一键播放）

1. 视频放进 `videos/`，例如 `videos/case-01.mp4`
2. 在 `works.js` 对应案例填写：

```js
video: "videos/case-01.mp4",
```

3. **公开网站要注意体积**
   - 单个视频建议压缩到 **50MB 以内** 再上传
   - 大视频请放到对象存储 / 可直链网盘，再写成：

```js
video: "https://你的域名或OSS地址/case-01.mp4",
```

## 建议素材规格

- 视频：`mp4`（H.264）
- 封面：`jpg` / `webp` / `svg`，宽度 ≥ 1280px
- 文件名用英文或数字，避免空格
