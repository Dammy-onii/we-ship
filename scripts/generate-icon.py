"""
Generates the Weship app icon set from vector maths — no design tooling, no
upscaling. The previous set was resampled from a 96px stock PNG and looked soft
at launcher sizes; every file here is rasterised at full resolution instead.

Motif: two overlapping hearts, echoing the "two voices" idea in DESIGN.md.
Palette is the app's own warm paper and clay.
"""
import math, struct, zlib, pathlib

PAPER      = (0xF6, 0xF3, 0xEE)
PAPER_EDGE = (0xEC, 0xE6, 0xDD)
CLAY       = (0x70, 0x49, 0x36)
BLOOM      = (0xB9, 0x7E, 0x82)
GRAPHITE   = (0x4B, 0x2F, 0x24)

SS = 3  # subsamples per axis


def heart_field(x, y):
    """Classic heart implicit curve; <= 0 is inside."""
    t = x * x + y * y - 1.0
    return t * t * t - x * x * y * y * y


def make_heart(cx, cy, scale, rotation):
    """Returns a membership test in unit-square coordinates."""
    cos_r, sin_r = math.cos(rotation), math.sin(rotation)

    def inside(px, py):
        dx, dy = (px - cx) / scale, (cy - py) / scale  # y up
        rx = dx * cos_r + dy * sin_r
        ry = -dx * sin_r + dy * cos_r
        return heart_field(rx, ry) <= 0.0

    return inside


def blend(base, top, alpha):
    return tuple(round(b + (t - b) * alpha) for b, t in zip(base, top))


def render(size, *, background, art_scale, mono=None):
    """Renders RGBA rows. `background=None` leaves the art on transparency.

    The pair is laid out around the canvas centre so the union of both hearts
    stays optically centred at every `art_scale`; the adaptive foreground just
    shrinks the whole composition inside the launcher's safe zone.
    """
    cx, cy = 0.5, 0.478
    spread_x, spread_y = 0.086 * art_scale, 0.029 * art_scale
    radius = 0.216 * art_scale

    back = make_heart(cx - spread_x, cy - spread_y, radius, math.radians(-14))
    front = make_heart(cx + spread_x, cy + spread_y, radius, math.radians(12))

    inv = 1.0 / size
    weight = 1.0 / (SS * SS)
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(SS):
                v = (py + (sy + 0.5) / SS) * inv
                for sx in range(SS):
                    u = (px + (sx + 0.5) / SS) * inv
                    in_back, in_front = back(u, v), front(u, v)

                    if mono is not None:
                        if in_back or in_front:
                            r += mono[0]; g += mono[1]; b += mono[2]; a += 255
                        continue

                    if background is None:
                        if not (in_back or in_front):
                            continue
                        colour = blend(BLOOM, CLAY, 0.90) if in_front and in_back else (
                            CLAY if in_front else BLOOM)
                        r += colour[0]; g += colour[1]; b += colour[2]; a += 255
                    else:
                        colour = blend(PAPER, PAPER_EDGE, v * 0.85)
                        if in_back:
                            colour = BLOOM
                        if in_front:
                            colour = blend(BLOOM, CLAY, 0.90) if in_back else CLAY
                        r += colour[0]; g += colour[1]; b += colour[2]; a += 255

            if a <= 0.0:
                row += b"\x00\x00\x00\x00"
            else:
                # Un-premultiply so partially covered edge pixels keep full colour.
                row += bytes((round(r / a * 255), round(g / a * 255),
                              round(b / a * 255), round(a * weight)))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    pathlib.Path(path).write_bytes(png)
    print(f"  {path}  {size}×{size}  {len(png) / 1024:.0f} KB")


out = pathlib.Path("assets/images/generated")
out.mkdir(parents=True, exist_ok=True)

print("Generating icons…")
# Full-bleed launcher / store icon.
write_png(out / "icon.png", 1024, render(1024, background=PAPER, art_scale=1.0))
# Adaptive foreground: art must sit inside the centre ~66% or the mask crops it.
write_png(out / "android-icon-foreground.png", 1024,
          render(1024, background=None, art_scale=0.72))
write_png(out / "android-icon-monochrome.png", 1024,
          render(1024, background=None, art_scale=0.72, mono=GRAPHITE))
# Splash renders at 160pt on a paper background, so it stays transparent.
write_png(out / "splash-icon.png", 512, render(512, background=None, art_scale=0.92))
write_png(out / "favicon.png", 64, render(64, background=PAPER, art_scale=1.0))
print("Done.")
