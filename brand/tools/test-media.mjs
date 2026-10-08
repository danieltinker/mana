/* Small test clips for the browser checks and the review sheets, made with ffmpeg from the film's placeholder stills when
   they are missing: .scratch/media/hero.webm (VP8: the test browser has no H.264), hero.mp4, film-16x9.mp4, film-9x16.mp4.
   They never go into site/: the checks overlay them through tools/serve.mjs. */
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MEDIA = join(ROOT, '.scratch', 'media');
export function ensureTestMedia() {
  mkdirSync(MEDIA, { recursive: true });
  const ff = (args) => execFileSync('/usr/bin/ffmpeg', ['-v', 'error', '-y', ...args]);
  const a = join(ROOT, 'tools', 'film', 'placeholders', 'guest-shakshuka.jpg'), b = join(ROOT, 'tools', 'film', 'placeholders', 'guest-margherita.jpg');
  if (!existsSync(join(MEDIA, 'hero.webm'))) ff(['-loop', '1', '-t', '2', '-i', a, '-loop', '1', '-t', '2', '-i', b, '-filter_complex',
    '[0:v]scale=390:844,setsar=1[a];[1:v]scale=390:844,setsar=1[b];[a][b]xfade=transition=slideup:duration=1:offset=1,format=yuv420p[v]', '-map', '[v]', '-r', '30', '-c:v', 'libvpx', '-b:v', '600k', '-an', join(MEDIA, 'hero.webm')]);
  if (!existsSync(join(MEDIA, 'hero.mp4'))) ff(['-i', join(MEDIA, 'hero.webm'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(MEDIA, 'hero.mp4')]);
  for (const [f, size] of [['film-16x9.mp4', '640x360'], ['film-9x16.mp4', '360x640']]) if (!existsSync(join(MEDIA, f)))
    ff(['-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=30:duration=2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(MEDIA, f)]);
  return MEDIA;
}
