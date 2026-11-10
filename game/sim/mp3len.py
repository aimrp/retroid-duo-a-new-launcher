# 数 MP3 帧算时长（不依赖第三方库）。用法：python -I sim/mp3len.py <文件>
import sys
d = open(sys.argv[1], 'rb').read()
i = 0
if d[:3] == b'ID3':
    i = 10 + ((d[6] & 127) << 21 | (d[7] & 127) << 14 | (d[8] & 127) << 7 | (d[9] & 127))
BR = {1: [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320], 2: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160]}
SR = {3: [44100,48000,32000], 2: [22050,24000,16000], 0: [11025,12000,8000]}
t = 0.0; n = 0; rates = set()
while i + 4 <= len(d):
    if d[i] != 0xFF or (d[i+1] & 0xE0) != 0xE0: i += 1; continue
    ver = (d[i+1] >> 3) & 3; lay = (d[i+1] >> 1) & 3; bri = d[i+2] >> 4; sri = (d[i+2] >> 2) & 3; pad = (d[i+2] >> 1) & 1
    if ver == 1 or lay != 1 or bri in (0, 15) or sri == 3: i += 1; continue
    br = BR[1 if ver == 3 else 2][bri] * 1000; sr = SR[ver][sri]
    spf = 1152 if ver == 3 else 576
    size = (144 if ver == 3 else 72) * br // sr + pad
    t += spf / sr; n += 1; rates.add(br // 1000); i += size
print(f'{t:.2f} 秒  {n} 帧  码率 {sorted(rates)} kbps')
