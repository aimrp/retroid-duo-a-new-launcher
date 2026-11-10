# 生成应用图标：Agent Deck 同款扁平风底板（粗黑描边 + 柔和渐变 + 一道高光）+ 像素小乌龟（壳壳队长）。
# 用法：C:/Python312/python.exe -I stophero/icon/gen_icon.py
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, '..', 'apk', 'res')
N = 1024
OUT = '#232323'

PAL = {'k': '#1a1426', 'g': '#2fb38c', 'G': '#1b6e59', 'l': '#f4e2ad', 'o': '#f39a48', 'O': '#c56a28',
       'e': '#ffffff', 'r': '#e0344c', 'R': '#9c1f33'}
TURTLE = [  # 与游戏里 art.js 的 turtle_walk1 相同
    '..........kkkk..', '.........krrrrk.', '......rr.kooooek', '.......rrkooookk', '...kkkkk.koooook',
    '..kgGggGkkOooook', '.kgggGgggkkOok..', '.kgGgggGglkok...', 'kggGgGggglkk....', 'kgGgggGgglk.....',
    'kggGgGggglok....', '.kgggGgglkook...', '.kllllllllkok...', '..kkkkkkkkk.....', '...koOk.koOk....',
    '...kook.kook....', '..kooOk.kooOk...', '..kkkk..kkkk....',
]


def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def vgrad(w, h, stops):
    im = Image.new('RGB', (w, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for i in range(len(stops) - 1):
            (t0, c0), (t1, c1) = stops[i], stops[i + 1]
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0) if t1 > t0 else 0
                c = tuple(round(a + (b - a) * k) for a, b in zip(hexrgb(c0), hexrgb(c1)))
                break
        for x in range(w): px[x, y] = c
    return im


def build():
    m = 56; R = 210; sw = 30  # 边距、圆角、描边
    box = (m, m, N - m, N - m)
    mask = Image.new('L', (N, N), 0); ImageDraw.Draw(mask).rounded_rectangle(box, R, fill=255)

    art = vgrad(N, N, [(0, '#ffcf8a'), (0.45, '#ff9a6a'), (0.62, '#c86a9a'), (0.63, '#5aa64f'), (0.66, '#4fae4a'), (1, '#2f7f33')])
    d = ImageDraw.Draw(art)
    # 夕阳
    d.ellipse((560, 330, 860, 630), fill='#ffe27a')
    # 远处城墙（像素城垛）
    wall = '#6d6d86'; y0 = 560
    d.rectangle((0, y0, N, 650), fill=wall)
    for x in range(0, N, 72): d.rectangle((x, y0 - 36, x + 40, y0), fill=wall)
    for y in range(y0, 650, 30):
        d.line((0, y, N, y), fill='#55556a', width=4)
    # 地面草皮
    d.rectangle((0, 760, N, N), fill='#c8643a')
    d.rectangle((0, 742, N, 790), fill='#4fbf5a')
    d.rectangle((0, 742, N, 752), fill='#9be36a')

    # 像素乌龟（带一层粗黑描边与地面投影）
    s = 34
    tw, th = len(TURTLE[0]) * s, len(TURTLE) * s
    tx, ty = (N - tw) // 2 + 10, 770 - th
    d.ellipse((tx + 30, 752, tx + tw - 90, 800), fill='#2b6a2f')
    for j, row in enumerate(TURTLE):
        for i, ch in enumerate(row):
            if ch in PAL:
                d.rectangle((tx + i * s, ty + j * s, tx + (i + 1) * s - 1, ty + (j + 1) * s - 1), fill=PAL[ch])

    tile = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    tile.paste(art, (0, 0), mask)
    # 高光：左上一道弧线
    hl = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(hl).arc((m + 40, m + 40, N - m - 40, N - m - 40), 195, 250, fill=(255, 255, 255, 190), width=26)
    tile = Image.alpha_composite(tile, hl)
    # 粗黑描边
    ImageDraw.Draw(tile).rounded_rectangle(box, R, outline=OUT, width=sw)
    # 底部投影
    shadow = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((m, m + 18, N - m, N - m + 18), R, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    return Image.alpha_composite(shadow, tile)


big = build()
big.save(os.path.join(HERE, 'icon_1024.png'))
for name, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = os.path.join(RES, 'mipmap-' + name); os.makedirs(d, exist_ok=True)
    big.resize((px, px), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
print('icon ok')
