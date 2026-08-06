# FreeConvert Concept · Dreamcore Moodboard

**项目：** 浏览器端图片转换站（非官方概念重设计）  
**主参考：** 夜草原 · 过曝白金光晕人像 · 竖排发光五角星 · 胶片颗粒

---

## 主参考图

`convert/assets/hero-field.png` — 深午夜蓝黑底、暖白/琥珀光晕、左侧星轨、film grain。

---

## Pinterest / 检索

| 用途 | 链接 / 关键词 |
| --- | --- |
| 主气质 | `dreamcore night field glowing person stars` |
| 合集板 | [Weirdcore//dreamcore//liminal spaces](https://www.pinterest.com/murdoczasylum/weirdcoredreamcoreliminal-spaces/) |
| 电影感夜景 | [Cinematic / Dreamcore / Liminal](https://in.pinterest.com/jaznik_/cinematic-dreamcore-liminal-vibes/) |
| 元素解析 | [Dreamcore visual elements](https://aesthetic-guide.com/dreamcore-visual-elements/) |
| 补充词 | `star filter light leak film grain` · `night meadow flash photography dreamcore` · `floating star stickers glow vignette` |

---

## 元素 → UI 落地

| 视觉元素 | 落地 |
| --- | --- |
| 全幅夜景人像 | Hero 全 bleed 背景 + 深色 veil |
| 过曝白金光晕 | Convert / Choose Files 按钮呼吸光晕（暖白/琥珀，非紫） |
| 竖排发光星 | 转换进度：5–7 星依次点亮 |
| Film grain | CSS 噪声叠层微动 |
| Soft focus / bloom | 上传区柔边光晕 hover |
| 深蓝黑 + 暖白 | `--bg #0a0c12` · `--ink #f4efe6` · `--glow #e8c87a` |

---

## 产品边界

- FreeConvert 流程：选文件 → 选格式 → 转换 → 下载
- 仅图片，浏览器端 `canvas.toBlob`，文件不上传
- 页眉/页脚：「Unofficial concept redesign · Not affiliated with FreeConvert.com」
