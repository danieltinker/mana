# Small pictures of the viewer's tables for the style strip (the viewer's own textures are 60-370 kB each; these are ~4 kB).
# Run from the studio folder:  python3 tools/table-thumbs.py [path to the viewer's themes folder]
import sys, os
from PIL import Image
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join('..', 'view', 'themes')
out = os.path.join('public', 'tables')
os.makedirs(out, exist_ok=True)
ids = ['oak', 'walnut', 'birch', 'gingham', 'gingham-blue', 'linen', 'damask', 'linen-black', 'marble', 'marble-black', 'terrazzo', 'concrete', 'slate', 'tiles', 'bamboo', 'kraft', 'steel', 'copper']
total = 0
for i in ids:
    p = os.path.join(src, i + '.jpg')
    if not os.path.exists(p):
        print('missing', p); continue
    im = Image.open(p).convert('RGB')
    s = min(im.size)
    # the middle of the texture, at a scale where the weave or grain still reads
    c = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((168, 168), Image.LANCZOS)
    dst = os.path.join(out, i + '.jpg')
    c.save(dst, 'JPEG', quality=72, optimize=True, progressive=True)
    total += os.path.getsize(dst)
print(len(ids), 'tables,', total, 'bytes')
