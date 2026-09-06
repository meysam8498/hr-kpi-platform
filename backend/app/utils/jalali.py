"""Jalali (Solar Hijri) ↔ Gregorian conversion — standard 33-year algorithm.

Shared by bulk import and any backend feature that accepts Jalali dates.
Mirrors the frontend conversion in frontend/src/lib/jalali.ts.
"""
from datetime import date


def jalali_to_gregorian(jy: int, jm: int, jd: int) -> tuple[int, int, int]:
    """Convert Jalali date (e.g. 1395/06/01) to Gregorian (y, m, d)."""
    jy += 1595
    days = (
        -355668
        + (365 * jy)
        + ((jy // 33) * 8)
        + (((jy % 33) + 3) // 4)
        + jd
        + ((jm < 7) and (jm - 1) * 31 or ((jm - 7) * 30 + 186))
    )
    gy = 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        days -= 1
        gy += 100 * (days // 36524)
        days %= 36524
        if days >= 365:
            days += 1
    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365
    gd = days + 1
    leap = ((gy % 4 == 0 and gy % 100 != 0) or (gy % 400 == 0))
    month_days = [0, 31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 1
    for m in range(1, 13):
        if gd <= month_days[m]:
            gm = m
            break
        gd -= month_days[m]
    return gy, gm, gd


def parse_jalali_or_gregorian(raw: str) -> date | None:
    """Parse a date string as Jalali (yyyy/mm/dd with year < 1700) or
    Gregorian (year >= 1700). Accepts / - . \\ separators and Persian digits.
    Returns a datetime.date or None if invalid.
    """
    import re
    from datetime import date as _date

    if raw is None:
        return None
    s = str(raw).translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'))
    s = s.strip().replace('\\', '/').replace('.', '/').replace('-', '/').split(' ')[0]
    m = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})$', s)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if mo < 1 or mo > 12 or d < 1 or d > 31:
        return None
    try:
        if y > 1700:
            return _date(y, mo, d)
        gy, gm, gd = jalali_to_gregorian(y, mo, d)
        return _date(gy, gm, gd)
    except ValueError:
        return None
