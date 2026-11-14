# -*- coding: utf-8 -*-
"""生成 StackMap 安卓图标（品牌色 #4361d8，三层菱形层叠 logo）。
用法：python make-icons.py
产出：替换 mipmap-*/ic_launcher*.png 与自适应背景色。
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.normpath(os.path.join(HERE, "android", "app", "src", "main", "res"))

ACCENT = (67, 97, 216)        # #4361d8
DARK = (24, 34, 84)           # 渐变底部
M = 1024


def gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img


def draw_logo(size):
    """透明底 + 三层菱形 logo，居中。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = size * 38.0 / M  # 以 1024 画布 u=38 为基准等比
    ox = size / 2 - 12 * u
    oy = size / 2 - 12 * u
    P = lambda x, y: (ox + x * u, oy + y * u)
    lw = max(int(1.7 * u), 2)
    # 顶部实心菱形
    d.polygon([P(12, 3), P(21, 8), P(12, 13), P(3, 8)], fill=(255, 255, 255, 255))
    # 中、下两层人字折线（透明度递减，体现“层叠”）
    for pts, alpha in [([(3, 12), (12, 17), (21, 12)], 200), ([(3, 16), (12, 21), (21, 16)], 130)]:
        a, b, c = [P(*p) for p in pts]
        d.line([a, b], fill=(255, 255, 255, alpha), width=lw)
        d.line([b, c], fill=(255, 255, 255, alpha), width=lw)
        r = lw / 2
        for p in (a, b, c):
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=(255, 255, 255, alpha))
    return img


# 1) 画布
legacy = gradient(M, M, ACCENT, DARK).convert("RGBA")
legacy.alpha_composite(draw_logo(M))
legacy = legacy.convert("RGB")

round_img = legacy.copy()
mask = Image.new("L", (M, M), 0)
ImageDraw.Draw(mask).ellipse([0, 0, M, M], fill=255)
round_img.putalpha(mask)

# 2) legacy 图标（方形 + 圆形）
DENS = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for dpi, px in DENS.items():
    folder = os.path.join(RES, f"mipmap-{dpi}")
    legacy.resize((px, px), Image.LANCZOS).save(os.path.join(folder, "ic_launcher.png"))
    round_img.resize((px, px), Image.LANCZOS).save(os.path.join(folder, "ic_launcher_round.png"))

# 3) 自适应前景（108dp 画布，logo 居中占 ~62%，安全区 66%）
logo = draw_logo(M)
for dpi, px in {**DENS, "xxxhdpi": 432, "xxhdpi": 324, "xhdpi": 216, "hdpi": 162, "mdpi": 108}.items():
    fg = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    s = int(px * 0.62)
    fg.alpha_composite(logo.resize((s, s), Image.LANCZOS), ((px - s) // 2, (px - s) // 2))
    fg.save(os.path.join(RES, f"mipmap-{dpi}", "ic_launcher_foreground.png"))

# 4) 自适应背景色 = 品牌蓝
bg_xml = os.path.join(RES, "values", "ic_launcher_background.xml")
with open(bg_xml, "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            '    <color name="ic_launcher_background">#4361D8</color>\n</resources>\n')

print("图标生成完成：mipmap 全密度 + 自适应前景/背景色")
