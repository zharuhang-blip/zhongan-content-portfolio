# 查如杭 · 内容作品集

**线上地址（公开，任何人可打开）：**  
https://zharuhang-blip.github.io/zhongan-content-portfolio/?v=47

**2027届秋招简历：**  
https://zharuhang-blip.github.io/zhongan-content-portfolio/docs/resume/resume.html?v=47

仓库：https://github.com/zharuhang-blip/zhongan-content-portfolio  

仓库与 GitHub Pages 均为公开。简历里无论写 `?v=45`、`?v=46`、`?v=47` 还是无参数，同一路径均可打开最新站点。

## 本地预览

```bash
python3 -m http.server 8765
```

浏览器打开 http://127.0.0.1:8765/?v=47

## 更新线上站点

```bash
git add index.html app.js styles.css works.js sw.js README.md docs/resume/resume.html
git commit -m "Update portfolio"
git push origin main
```

推送到 `main` 后，GitHub Pages 约 1 分钟自动刷新。
