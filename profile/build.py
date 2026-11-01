"""Build the DASMAN company profile PDF.

    python3 profile/build.py            # -> profile/dasman-profile.pdf
    python3 profile/build.py --preview  # also writes page PNGs to profile/preview/

Needs: python `qrcode` (pip install qrcode) and Playwright for Node with Chromium.
"""
import pathlib
import re
import subprocess
import sys

import qrcode
import qrcode.image.svg

ROOT = pathlib.Path(__file__).resolve().parent
SITE = "https://dasman.the-luxury-club.com/"


def qr_svg(url: str) -> str:
    img = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, border=0,
                      error_correction=qrcode.constants.ERROR_CORRECT_M)
    svg = img.to_string(encoding="unicode")
    svg = re.sub(r"<\?xml[^>]*\?>", "", svg)
    svg = re.sub(r'\swidth="[^"]*"\s+height="[^"]*"', "", svg, count=1)
    return svg.replace('fill="#000000"', 'fill="#262a19"')


def icon_sprite() -> str:
    sprite = (ROOT.parent / "public/imgs/icons.svg").read_text(encoding="utf-8")
    return sprite.replace("<svg ", '<svg style="position:absolute;width:0;height:0" aria-hidden="true" ', 1)


def main() -> None:
    html = (ROOT / "profile.html").read_text(encoding="utf-8")
    html = html.replace("<!--ICONS-->", icon_sprite()).replace("<!--QR-->", qr_svg(SITE))
    out = ROOT / "_build.html"
    out.write_text(html, encoding="utf-8")
    args = ["node", str(ROOT / "render.cjs"), str(out), str(ROOT / "dasman-profile.pdf")]
    if "--preview" in sys.argv:
        args.append(str(ROOT / "preview"))
    try:
        subprocess.run(args, check=True)
    finally:
        out.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
