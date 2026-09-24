from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "images"
SCALE = 3
FOREST = "#496B57"
PAPER = "#F5F2EA"
CLAY = "#B9654B"


def bezier(p0, p1, p2, p3, steps=120):
    points = []
    for index in range(steps + 1):
        t = index / steps
        u = 1 - t
        point = tuple(
            round(u**3 * p0[axis] + 3 * u**2 * t * p1[axis] + 3 * u * t**2 * p2[axis] + t**3 * p3[axis])
            for axis in range(2)
        )
        points.append((point[0] * SCALE, point[1] * SCALE))
    return points


def mark(size, primary, accent, transparent=False):
    image = Image.new("RGBA", (size * SCALE, size * SCALE), (0, 0, 0, 0) if transparent else primary)
    draw = ImageDraw.Draw(image)
    if transparent:
        paper = primary
    else:
        paper = PAPER

    arch = bezier((265, 690), (278, 450), (372, 320), (512, 320))
    arch += bezier((512, 320), (652, 320), (746, 450), (759, 690))[1:]
    draw.line(arch, fill=paper, width=52 * SCALE, joint="curve")
    draw.line([(346 * SCALE, 690 * SCALE), (678 * SCALE, 690 * SCALE)], fill=paper, width=52 * SCALE)

    radius = 51 * SCALE
    center = (512 * SCALE, 475 * SCALE)
    draw.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), fill=accent)
    shoulders = bezier((398, 666), (407, 563), (454, 536), (512, 536))
    shoulders += bezier((512, 536), (570, 536), (617, 563), (626, 666))[1:]
    draw.line(shoulders, fill=accent, width=61 * SCALE, joint="curve")
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main():
    IMAGES.mkdir(parents=True, exist_ok=True)
    mark(1024, FOREST, CLAY).convert("RGB").save(IMAGES / "icon.png", optimize=True)
    mark(1024, PAPER, CLAY, transparent=True).save(IMAGES / "android-icon-foreground.png", optimize=True)
    mark(1024, "#FFFFFF", "#FFFFFF", transparent=True).save(IMAGES / "android-icon-monochrome.png", optimize=True)
    Image.new("RGB", (432, 432), FOREST).save(IMAGES / "android-icon-background.png", optimize=True)
    mark(512, FOREST, CLAY, transparent=True).save(IMAGES / "splash-icon.png", optimize=True)
    mark(48, FOREST, CLAY).convert("RGB").save(IMAGES / "favicon.png", optimize=True)


if __name__ == "__main__":
    main()
