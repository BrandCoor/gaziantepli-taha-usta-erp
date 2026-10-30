"""Garson PWA simgeleri (saf Python, ek paket gerektirmez). Kullanım: python tools/make-icons.py"""
import struct, zlib, os

GOLD = (245, 200, 119)
DARK = (20, 20, 22)


def png(path, size):
    # Koyu zemin, altın yuvarlak, içinde koyu "T" harfi (maskable için güvenli bölge içinde)
    cx = cy = size / 2
    r = size * 0.36
    bar_w, bar_h = size * 0.30, size * 0.07      # T'nin üst çubuğu
    stem_w, stem_h = size * 0.08, size * 0.26    # T'nin gövdesi
    top = cy - size * 0.17
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            col = DARK
            if d <= r:
                col = GOLD
                in_bar = abs(x - cx) <= bar_w and top <= y <= top + bar_h
                in_stem = abs(x - cx) <= stem_w and top <= y <= top + bar_h + stem_h
                if in_bar or in_stem:
                    col = DARK
            row += bytes(col)
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)


here = os.path.join(os.path.dirname(__file__), '..', 'cpanel-yuklenecekler', 'garson')
for size, name in ((180, 'icon-180.png'), (192, 'icon-192.png'), (512, 'icon-512.png')):
    png(os.path.join(here, name), size)
    print('yazıldı', name)
