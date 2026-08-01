# 查如杭 · 内容运营作品集

本地可预览，也可部署成任何人都能打开的公开网址。

## 本地预览

```bash
cd /Users/charuhang/zhongan-content-portfolio
python3 -m http.server 5173
```

浏览器打开 http://localhost:5173

## 让所有人都能打开（推荐两种）

### 方式 A：Netlify Drop（最快，约 1 分钟）

1. 打开 https://app.netlify.com/drop （可用邮箱注册，也支持拖拽免复杂配置）
2. 把项目里的 `portfolio-public.zip` 拖进去  
   或直接把整个文件夹拖进去：`index.html`、`styles.css`、`app.js`、`works.js`、`covers/`、`videos/`
3. 得到类似 `https://xxxx.netlify.app` 的链接，发给任何人都能打开

已为你生成：`portfolio-public.zip`（在本项目根目录）

### 方式 B：GitHub Pages（简历更常用，链接更稳定）

1. 注册/登录 [GitHub](https://github.com)
2. 新建仓库，例如 `zhongan-content-portfolio`（Public）
3. 在本项目目录执行：

```bash
git add .
git commit -m "Publish content portfolio site"
git branch -M main
git remote add origin https://github.com/你的用户名/zhongan-content-portfolio.git
git push -u origin main
```

4. 打开仓库 Settings → Pages  
   - Source 选 **GitHub Actions**  
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
