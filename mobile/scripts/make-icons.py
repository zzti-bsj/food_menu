#!/usr/bin/env python3
"""生成「食刻」品牌图标资源(朱砂印章「食」· 与 App 内 Seal 组件同语言)。

产出(mobile/assets/images/):
  icon.png                    1024 通用图标:暖纸底 + 印章(带柔影)
  android-icon-foreground.png 1024 adaptive 前景:透明底 + 印章(安全区内)
  android-icon-background.png 1024 adaptive 背景:暖纸微渐变
  android-icon-monochrome.png 1024 单色(白色圆角方,「食」镂空)
  splash-icon.png             512  启动屏印章(透明底,平贴无影)

颜色/几何取自 src/theme/tokens.ts + components/brand/seal.tsx:
  纸底 #FAF6ED / 印泥红渐变 #CC4A3C→#B03A2E / 圆角 0.235S / 微倾 -3°
用法:python3 scripts/make-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ASSETS = Path(__file__).resolve().parent.parent / "assets" / "images"
SONGTI = "/System/Library/Fonts/Supplemental/Songti.ttc"
SONGTI_BLACK_INDEX = 0  # Songti SC Black

PAPER = (250, 246, 237)  # #FAF6ED
PAPER_TINT = (243, 239, 227)  # #F3EFE3
SEAL = (176, 58, 46)  # #B03A2E
SEAL_LIGHT = (204, 74, 60)  # #CC4A3C
WHITE = (255, 255, 255)

CHAR = "食"
ROTATE = -3  # 与 Seal 组件 transform rotate -3deg 同源


def diag_gradient(size: int, top_left: tuple, bottom_right: tuple) -> Image.Image:
    """对角线性渐变(左上→右下),小图计算后放大保平滑。"""
    n = 256
    g = Image.new("RGB", (n, n))
    px = g.load()
    denom = 2 * (n - 1)
    for y in range(n):
        for x in range(n):
            t = (x + y) / denom
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(top_left, bottom_right))
    return g.resize((size, size), Image.LANCZOS)


def seal_layer(canvas: int, side: int, knockout: bool = False) -> Image.Image:
    """印章图层(2x 超采样抗锯齿)。knockout=True 输出单色剪影(字镂空)。"""
    s = canvas * 2
    box = side * 2
    radius = round(side * 0.235)
    font_px = round(side * 0.56)
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    if knockout:
        # 单色:白色圆角方的 alpha 蒙版,字形区域镂空(transparent)
        mask = Image.new("L", (s, s), 0)
        d = ImageDraw.Draw(mask)
        cx = s / 2
        half = box / 2
        d.rounded_rectangle([cx - half, cx - half, cx + half, cx + half], radius=radius * 2, fill=255)
        font = ImageFont.truetype(SONGTI, font_px * 2, index=SONGTI_BLACK_INDEX)
        d.text((cx, cx), CHAR, font=font, fill=0, anchor="mm")
        white = Image.new("RGBA", (s, s), (*WHITE, 255))
        white.putalpha(mask)
        layer = white
    else:
        grad = diag_gradient(box, SEAL_LIGHT, SEAL)
        square = Image.new("L", (box, box), 0)
        ImageDraw.Draw(square).rounded_rectangle([0, 0, box, box], radius=radius * 2, fill=255)
        tile = Image.new("RGBA", (box, box), (0, 0, 0, 0))
        tile.paste(grad, (0, 0), square)
        font = ImageFont.truetype(SONGTI, font_px * 2, index=SONGTI_BLACK_INDEX)
        ImageDraw.Draw(tile).text((box / 2, box / 2), CHAR, font=font, fill=WHITE, anchor="mm")
        layer.paste(tile, ((s - box) // 2, (s - box) // 2), tile)

    return layer.rotate(ROTATE, resample=Image.BICUBIC, center=(s / 2, s / 2)).resize(
        (canvas, canvas), Image.LANCZOS
    )


def compose_general_icon(canvas: int = 1024, side: int = 560) -> Image.Image:
    """通用图标:纸底铺满 + 居中印章 + 柔影。"""
    icon = Image.new("RGB", (canvas, canvas), PAPER)
    # 柔影:黑色圆角方模糊后垫底(仅印章大小范围,不随旋转)
    shadow = Image.new("L", (canvas, canvas), 0)
    half = side / 2
    ImageDraw.Draw(shadow).rounded_rectangle(
        [canvas / 2 - half, canvas / 2 - half + side * 0.018,
         canvas / 2 + half, canvas / 2 + half + side * 0.018],
        radius=side * 0.235, fill=70,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(side * 0.045))
    dark = Image.new("RGBA", (canvas, canvas), (38, 35, 28, 255))  # ink
    icon.paste(dark, (0, 0), shadow)
    icon.paste(seal_layer(canvas, side), (0, 0), seal_layer(canvas, side))
    return icon


def circle_crop(canvas: int) -> Image.Image:
    """模拟启动器圆形裁切预览:背景 + 前景。"""
    bg = Image.open(ASSETS / "android-icon-background.png").convert("RGB")
    fg = Image.open(ASSETS / "android-icon-foreground.png").convert("RGBA")
    preview = bg.resize((canvas, canvas), Image.LANCZOS)
    preview.paste(fg.resize((canvas, canvas), Image.LANCZOS), (0, 0), fg.resize((canvas, canvas), Image.LANCZOS))
    mask = Image.new("L", (canvas, canvas), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, canvas, canvas], fill=255)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(preview, (0, 0), mask)
    return out


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    # 通用图标(暖纸底 + 印章柔影)
    compose_general_icon().save(ASSETS / "icon.png")

    # Android adaptive 前景:印章边长 45%,旋转后对角线 ~63% 仍在 66% 安全区内
    seal_layer(1024, 460).save(ASSETS / "android-icon-foreground.png")
    # Android adaptive 背景:暖纸微渐变
    diag_gradient(1024, PAPER, PAPER_TINT).save(ASSETS / "android-icon-background.png")
    # Android 单色(白剪影,字镂空)
    seal_layer(1024, 460, knockout=True).save(ASSETS / "android-icon-monochrome.png")
    # 启动屏印章(透明底平贴)
    seal_layer(512, 440).save(ASSETS / "splash-icon.png")

    # 预览图(仅本地产出 /tmp,便于目视核对):圆裁前景+背景、通用图标、单色
    preview = Image.new("RGBA", (1024, 540), (255, 255, 255, 255))
    preview.paste(circle_crop(512), (4, 14), circle_crop(512))
    preview.paste(Image.open(ASSETS / "icon.png").resize((512, 512), Image.LANCZOS), (508, 14))
    preview.save(Path("/tmp/shike-icon-preview.png"))

    print("written:", *(p.name for p in sorted(ASSETS.glob("*icon*"))), "splash-icon.png", sep="\n  ")


if __name__ == "__main__":
    main()
