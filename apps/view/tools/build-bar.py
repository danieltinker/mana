#!/usr/bin/env python3
"""Makes the bar counter texture pair in themes/: bar-stone.jpg (colour) and bar-stone_h.jpg (height), both tileable.
A dark honed stone: quiet mottling, fine flecks, a few soft veins. Same convention as the table textures (the shader squares
the colour, the height map only feeds the bump).   Run from view/:  python3 tools/build-bar.py"""
import os
import numpy as np
from PIL import Image

N = 1024
rng = np.random.default_rng(20261006)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'themes')


def noise(beta, lo=0.0, hi=1e9):
    """Periodic noise with a 1/f^beta spectrum, band-limited to [lo, hi] cycles per tile, scaled to mean 0, std 1."""
    f = np.fft.fftfreq(N) * N
    fx, fy = np.meshgrid(f, f)
    r = np.hypot(fx, fy)
    amp = np.where((r > lo) & (r < hi), 1.0 / np.maximum(r, 1.0) ** beta, 0.0)
    spec = amp * np.exp(2j * np.pi * rng.random((N, N)))
    n = np.real(np.fft.ifft2(spec))
    return (n - n.mean()) / n.std()


mottle = noise(1.9, 1, 40)                         # large soft clouds
grain = noise(0.6, 60, 400)                        # fine grain of the stone
warp = noise(2.2, 1, 9)
ridge = noise(2.4, 1, 7) + 0.35 * warp             # veins run along the zero lines of a slow field
vein = np.clip(1.0 - np.abs(ridge) / 0.045, 0, 1) ** 1.5 * np.clip(0.5 + 0.5 * noise(2.0, 1, 12), 0, 1)
fleck = np.clip((noise(0.0, 120, 512) - 2.35) / 1.2, 0, 1)      # sparse bright mica flecks

base = np.array([47.0, 45.0, 44.0])
warm = np.array([8.0, 5.0, 2.0])
img = base[None, None, :] + mottle[..., None] * 5.0 + (mottle * warp)[..., None] * warm * 0.35 + grain[..., None] * 3.2
img += vein[..., None] * np.array([34.0, 36.0, 35.0]) + fleck[..., None] * np.array([70.0, 68.0, 62.0])
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'bar-stone.jpg'), quality=88, optimize=True)

h = 128 + grain * 5.0 - fleck * 26.0 - vein * 7.0 + mottle * 3.0
Image.fromarray(np.clip(h, 0, 255).astype(np.uint8)).convert('L').save(os.path.join(OUT, 'bar-stone_h.jpg'), quality=85, optimize=True)
print('bar-stone', os.path.getsize(os.path.join(OUT, 'bar-stone.jpg')), os.path.getsize(os.path.join(OUT, 'bar-stone_h.jpg')))
