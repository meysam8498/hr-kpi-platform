"""
Server-side PDF generation with full Persian RTL support.

Pipeline: logical Persian text → arabic_reshaper (contextual glyph forms)
→ python-bidi (visual reordering) → fpdf2 writes the visual string.

Font: Vazirmatn (SIL OFL — free for commercial use). The .ttf files live in
backend/app/assets/fonts/. If they are missing, PDF endpoints return a clear
Persian error instead of crashing.
"""
import io
from pathlib import Path

from fpdf import FPDF

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    _SHAPING = True
except ImportError:  # graceful degradation — Latin-only PDFs still work
    _SHAPING = False

FONTS_DIR = Path(__file__).parent / "assets" / "fonts"
FONT_REGULAR = FONTS_DIR / "Vazirmatn-Regular.ttf"
FONT_BOLD = FONTS_DIR / "Vazirmatn-Bold.ttf"

# Palette (matches the app's dark-on-light report look)
INDIGO = (79, 70, 229)
SLATE = (51, 65, 85)
MUTED = (107, 114, 128)
GREEN = (16, 122, 87)
AMBER = (180, 83, 9)
RED = (185, 28, 28)
LINE = (226, 232, 240)


def _shape(text: str) -> str:
    """Reshape + bidi-reorder Persian text for correct PDF rendering."""
    if not _SHAPING or not text:
        return text
    return get_display(arabic_reshaper.reshape(str(text)))


def _fa_num(value) -> str:
    """Format a number with Persian digits."""
    table = str.maketrans("0123456789.", "۰۱۲۳۴۵۶۷۸۹٫")
    return str(value).translate(table)


def fonts_available() -> bool:
    return FONT_REGULAR.exists() and FONT_BOLD.exists()


class KPIPDF(FPDF):
    """A4 portrait PDF with a repeated header/footer, Persian-aware."""

    def __init__(self, title: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.report_title = title
        self.set_auto_page_break(auto=True, margin=18)
        if fonts_available():
            self.add_font("Vazir", "", str(FONT_REGULAR))
            self.add_font("Vazir", "B", str(FONT_BOLD))
        else:
            # fpdf2 core font — Latin fallback so the file still generates
            self.set_font("Helvetica", size=10)

    def header(self):
        if self.page_no() == 1:
            return
        if fonts_available():
            self.set_font("Vazir", "B", 9)
        else:
            self.set_font("Helvetica", "B", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 8, _shape(self.report_title), align="C")
        self.ln(10)

    def footer(self):
        self.set_y(-14)
        if fonts_available():
            self.set_font("Vazir", "", 8)
        else:
            self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, _shape(f"صفحه {_fa_num(self.page_no())} از {_fa_num(self.alias_nb_pages())}"), align="C")

    # ─── helpers ────────────────────────────────────────────
    def title_bar(self, text: str):
        self.set_fill_color(*INDIGO)
        self.set_text_color(255, 255, 255)
        if fonts_available():
            self.set_font("Vazir", "B", 15)
        else:
            self.set_font("Helvetica", "B", 13)
        self.cell(0, 14, _shape(text), align="C", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def section(self, text: str):
        self.ln(2)
        self.set_text_color(*SLATE)
        if fonts_available():
            self.set_font("Vazir", "B", 12)
        else:
            self.set_font("Helvetica", "B", 11)
        self.cell(0, 8, _shape(text), align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*LINE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)

    def kv_row(self, label: str, value: str, value_color=SLATE):
        self.set_text_color(*MUTED)
        if fonts_available():
            self.set_font("Vazir", "", 10)
        else:
            self.set_font("Helvetica", "", 10)
        self.cell(60, 8, _shape(label), align="R")
        self.set_text_color(*value_color)
        self.cell(0, 8, _shape(value), align="R", new_x="LMARGIN", new_y="NEXT")

    def table(self, headers: list[str], rows: list[list[str]], col_widths: list[float],
              score_col: int | None = None):
        """Right-to-left table: first header is the right-most column."""
        if fonts_available():
            self.set_font("Vazir", "B", 9.5)
        else:
            self.set_font("Helvetica", "B", 9)
        self.set_fill_color(*INDIGO)
        self.set_text_color(255, 255, 255)
        self.set_draw_color(*LINE)
        # headers right→left
        for i, h in enumerate(reversed(headers)):
            self.cell(col_widths[len(headers) - 1 - i], 9, _shape(h), border=1, align="C", fill=True)
        self.ln()

        self.set_text_color(*SLATE)
        if fonts_available():
            self.set_font("Vazir", "", 9.5)
        else:
            self.set_font("Helvetica", "", 9)
        fill = False
        for row in rows:
            if self.will_page_break(10):
                # repeat header on the new page
                self.set_font("Vazir", "B", 9.5) if fonts_available() else self.set_font("Helvetica", "B", 9)
                self.set_fill_color(*INDIGO)
                self.set_text_color(255, 255, 255)
                for i, h in enumerate(reversed(headers)):
                    self.cell(col_widths[len(headers) - 1 - i], 9, _shape(h), border=1, align="C", fill=True)
                self.ln()
                self.set_text_color(*SLATE)
                if fonts_available():
                    self.set_font("Vazir", "", 9.5)
            if fill:
                self.set_fill_color(244, 246, 251)
            for i, val in enumerate(reversed(row)):
                color = SLATE
                if score_col is not None and i == (len(row) - 1 - score_col):
                    try:
                        s = float(str(val).translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٫", "0123456789.")))
                        color = GREEN if s >= 70 else AMBER if s >= 50 else RED
                    except ValueError:
                        color = SLATE
                self.set_text_color(*color)
                self.cell(col_widths[i], 9, _shape(val), border=1, align="C", fill=fill)
            self.ln()
            fill = not fill


def score_color(score: float | None):
    if score is None:
        return MUTED
    if score >= 70:
        return GREEN
    if score >= 50:
        return AMBER
    return RED


def build_pdf(render) -> io.BytesIO:
    """Run a render callback on a fresh KPIPDF and return the bytes buffer."""
    pdf = render()
    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return buf
