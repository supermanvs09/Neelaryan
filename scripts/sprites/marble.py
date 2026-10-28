import numpy as np, sys
from PIL import Image, ImageFilter
N = 2048
rs = np.random.RandomState(7)

def value_noise(n, cells):
    # tileable value noise via bicubic upscale of random grid
    g = rs.rand(cells, cells).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
    # make it tile by wrapping: blend not needed for a single slab
    return np.asarray(im, dtype=np.float32) / 255.0

def fbm(n, base=4, octaves=6):
    out = np.zeros((n, n), np.float32); amp = 1; tot = 0
    for o in range(octaves):
        out += value_noise(n, base * 2 ** o) * amp; tot += amp; amp *= 0.5
    return out / tot

y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
warp = fbm(N, 3, 6)
warp2 = fbm(N, 5, 5)
# main diagonal veins (like the logo backdrop)
t = (x * 1.3 + y * 0.7) + warp * 1.5 + warp2 * 0.35
veins = np.abs(np.sin(t * np.pi * 0.9))
fine = np.power(1 - veins, 60)          # thin crisp vein
soft = np.power(1 - veins, 6)           # soft halo
t2 = (x * -0.5 + y * 1.4) + fbm(N, 3, 6) * 1.2
v2 = np.power(1 - np.abs(np.sin(t2 * np.pi * 0.8)), 160) * 0.45
cloud = fbm(N, 3, 7)

base = np.array([246, 238, 222], np.float32)   # warm ivory
shade = np.array([233, 220, 196], np.float32)  # champagne cloud
gold = np.array([196, 152, 78], np.float32)    # gold vein
img = base[None, None] * (1 - cloud[..., None] * 0.55) + shade[None, None] * (cloud[..., None] * 0.55)
img = img * (1 - soft[..., None] * 0.12) + shade * soft[..., None] * 0.12
vein = np.clip(fine * 0.7 + v2, 0, 1)
img = img * (1 - vein[..., None]) + gold * vein[..., None]
img = np.clip(img, 0, 255).astype(np.uint8)
im = Image.fromarray(img).filter(ImageFilter.GaussianBlur(0.6))
im.save(sys.argv[1] + '/marble_diff.webp', 'WEBP', quality=84, method=6)
# roughness: polished stone, veins slightly rougher
rough = np.clip(0.18 + cloud * 0.12 + vein * 0.25, 0, 1)
Image.fromarray((rough * 255).astype(np.uint8)).resize((1024, 1024)).save(sys.argv[1] + '/marble_rough.webp', 'WEBP', quality=70)
im.resize((512, 512)).save(sys.argv[1] + '/marble_preview.png')
print('ok')
