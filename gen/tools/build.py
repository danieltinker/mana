#!/usr/bin/env python3
"""Maintenance tool for the generator folder (not needed at run time).

  python tools/build.py add-model <kind> <id> <file.onnx> --label .. --licence .. --source .. [--root DIR]
      copy a model into <root>/models (split into 8 MB parts: static hosts cap file size, and parts make a
      failed download resume where it stopped) and record it in <root>/models/models.json
  python tools/build.py manifest [--roots A,B] [--preset default=u2netp,da2s-fp16 ...]
      hash every runtime, code and model file and write <first root>/manifest.js
"""
import argparse, datetime, hashlib, json, os, shutil, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PART = 8 * 1024 * 1024
RUNTIME = [
    'vendor/ort/ort.wasm.bundle.min.mjs', 'vendor/ort/ort-wasm-simd-threaded.wasm',
    'vendor/pyodide/pyodide.mjs', 'vendor/pyodide/pyodide.asm.js', 'vendor/pyodide/pyodide.asm.wasm',
    'vendor/pyodide/python_stdlib.zip', 'vendor/pyodide/pyodide-lock.json',
    'vendor/pyodide/numpy-2.2.5-cp313-cp313-pyemscripten_2025_0_wasm32.whl',
    'vendor/pyodide/opencv_python-4.11.0.86-cp313-cp313-pyemscripten_2025_0_wasm32.whl',
    'vendor/pyodide/pillow-11.3.0-cp313-cp313-pyemscripten_2025_0_wasm32.whl',
    'pipeline.py', 'bridge.py',
]
VERSIONS = {'onnxruntimeWeb': '1.30.0', 'pyodide': '0.29.5', 'python': '3.13.2', 'numpy': '2.2.5', 'opencv': '4.11.0', 'pillow': '11.3.0'}


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def add_model(a):
    root = a.root or HERE
    md = os.path.join(root, 'models')
    os.makedirs(md, exist_ok=True)
    reg_path = os.path.join(md, 'models.json')
    reg = json.load(open(reg_path)) if os.path.exists(reg_path) else {'matte': {}, 'depth': {}}
    name = os.path.basename(a.file)
    size = os.path.getsize(a.file)
    for f in os.listdir(md):                                  # replace an earlier copy
        if f == name or f.startswith(name + '.part'):
            os.remove(os.path.join(md, f))
    if size <= PART:
        shutil.copy(a.file, os.path.join(md, name))
    else:
        with open(a.file, 'rb') as f:
            i = 0
            while True:
                b = f.read(PART)
                if not b:
                    break
                open(os.path.join(md, f'{name}.part{i:02d}'), 'wb').write(b)
                i += 1
    reg[a.kind][a.id] = {'file': 'models/' + name, 'size': size, 'sha256': sha(a.file), 'label': a.label, 'licence': a.licence,
                         'source': a.source, 'note': a.note or ''}
    json.dump(reg, open(reg_path, 'w'), indent=1)
    print('added', a.kind, a.id, size, 'bytes')


def find(roots, rel):
    for r in roots:
        p = os.path.join(r, rel)
        if os.path.exists(p):
            return p
    return None


def manifest(a):
    roots = [os.path.abspath(r) for r in (a.roots.split(',') if a.roots else [HERE])]
    files, models = {}, {'matte': {}, 'depth': {}}
    for rel in RUNTIME:
        p = find(roots, rel)
        if not p:
            sys.exit('missing ' + rel)
        files[rel] = {'size': os.path.getsize(p), 'sha256': sha(p)}
    for r in reversed(roots):
        reg_path = os.path.join(r, 'models', 'models.json')
        if not os.path.exists(reg_path):
            continue
        reg = json.load(open(reg_path))
        for kind in ('matte', 'depth'):
            for mid, m in reg[kind].items():
                rel = m['file']
                entry = {'size': m['size'], 'sha256': m['sha256']}
                whole = os.path.join(r, rel)
                if os.path.exists(whole):
                    assert sha(whole) == m['sha256'], rel
                else:
                    parts, i, tot, h = [], 0, 0, hashlib.sha256()
                    while os.path.exists(os.path.join(r, f'{rel}.part{i:02d}')):
                        pp = os.path.join(r, f'{rel}.part{i:02d}')
                        h.update(open(pp, 'rb').read())
                        parts.append({'path': f'{rel}.part{i:02d}', 'size': os.path.getsize(pp), 'sha256': sha(pp)})
                        tot += parts[-1]['size']
                        i += 1
                    assert parts and tot == m['size'] and h.hexdigest() == m['sha256'], rel
                    entry['parts'] = parts
                files[rel] = entry
                models[kind][mid] = {'file': rel, 'label': m['label'], 'licence': m['licence']}
    presets = {}
    for p in a.preset or []:
        name, v = p.split('=')
        mt, dp = v.split(',')
        assert mt in models['matte'] and dp in models['depth'], p
        presets[name] = {'matte': mt, 'depth': dp}
    if 'default' not in presets:
        sys.exit('need --preset default=<matte>,<depth>')
    digest = hashlib.sha256(json.dumps([files, models, presets], sort_keys=True).encode()).hexdigest()[:10]
    man = {'pipeline': 'halom-relief/1', 'build': datetime.date.today().isoformat() + '-' + digest, 'versions': VERSIONS,
           'runtime': RUNTIME, 'presets': presets, 'models': models, 'files': files}
    out = os.path.join(roots[0], 'manifest.js')
    with open(out, 'w') as f:
        f.write('// Generated by tools/build.py: every file the generator loads, with size and SHA-256. Do not edit by hand.\n')
        f.write('export default ' + json.dumps(man, indent=1) + ';\n')
    print('wrote', out, 'build', man['build'])
    for name, p in presets.items():
        tot = sum(files[f]['size'] for f in RUNTIME) + files[models['matte'][p['matte']]['file']]['size'] + files[models['depth'][p['depth']]['file']]['size']
        print(f'  preset {name}: {p}  first download {tot} bytes ({tot / 1e6:.1f} MB)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('add-model')
    s.add_argument('kind', choices=['matte', 'depth']); s.add_argument('id'); s.add_argument('file')
    s.add_argument('--label', required=True); s.add_argument('--licence', required=True); s.add_argument('--source', required=True)
    s.add_argument('--note'); s.add_argument('--root')
    s.set_defaults(fn=add_model)
    s = sub.add_parser('manifest')
    s.add_argument('--roots'); s.add_argument('--preset', action='append')
    s.set_defaults(fn=manifest)
    a = ap.parse_args()
    a.fn(a)
