"""Build the DASMAN company profile PDF.

    python3 profile/build.py            # -> profile/dasman-profile.pdf
    python3 profile/build.py --preview  # also keeps the page JPEGs in profile/preview/

Each page is rendered to a 3840x2160 image and the PDF is made from those images,
so it looks the same on iPhone, Android and desktop viewers.
Needs: pip install qrcode img2pdf, and Playwright for Node with Chromium.
"""
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

import img2pdf
import qrcode
import qrcode.image.svg

ROOT = pathlib.Path(__file__).resolve().parent
SITE = "https://dasman.the-luxury-club.com/"
PDF = ROOT / "dasman-profile.pdf"


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
    built = ROOT / "_build.html"
    built.write_text(html, encoding="utf-8")
    shots = pathlib.Path(tempfile.mkdtemp(prefix="dasman-profile-"))
    try:
        subprocess.run(["node", str(ROOT / "render.cjs"), str(built), str(shots)], check=True)
        pages = sorted(shots.glob("page-*.jpg"))
        # 1920x1080 px page = 1440x810 pt; images are 2x for sharpness.
        layout = img2pdf.get_layout_fun((img2pdf.px_to_pt(1920, 96), img2pdf.px_to_pt(1080, 96)))
        PDF.write_bytes(img2pdf.convert([str(p) for p in pages], layout_fun=layout,
                                        title="DASMAN — Company Profile", author="DASMAN · The Luxury Club"))
        print(f"PDF written: {PDF} ({len(pages)} pages, {PDF.stat().st_size / 1e6:.1f} MB)")
        if "--preview" in sys.argv:
            preview = ROOT / "preview"
            shutil.rmtree(preview, ignore_errors=True)
            shutil.copytree(shots, preview)
    finally:
        built.unlink(missing_ok=True)
        shutil.rmtree(shots, ignore_errors=True)


if __name__ == "__main__":
    main()
