import re

import imslp.interfaces.internal

from .constants import IMSLP_WIKI_PREFIX, KNOWN_INSTRUMENTS, INSTRUMENT_NORMALIZE, COMPOSER_FROM_TITLE


def extract_page_title(permlink: str) -> str:
    if permlink.startswith(IMSLP_WIKI_PREFIX):
        permlink = permlink[len(IMSLP_WIKI_PREFIX):]
    # Strip Category: prefix for person pages
    if permlink.startswith("Category:"):
        permlink = permlink[len("Category:"):]
    return permlink


def extract_instruments_from_file_title(title: str) -> list:
    """
    Extract instrument/part labels from an IMSLP file title.
    Returns a list like ['Score'] or ['Violin'] or ['Oboe'].
    """
    if not title:
        return []

    # Strip common extensions (some titles have nested extensions like .musx.pdf)
    ext_stripped = title
    pattern = r"\.(pdf|mp3|midi?|mid|musx?|xml|mxl|sib|mscz)$"
    while re.search(pattern, ext_stripped, re.IGNORECASE):
        ext_stripped = re.sub(pattern, "", ext_stripped, flags=re.IGNORECASE)

    # Split on common delimiters: dash, underscore, space
    parts = re.split(r"[-_\s]+", ext_stripped)
    if not parts:
        return []

    # Check the last non-empty segment (most common pattern: "... - Instrument.pdf")
    for part in reversed(parts):
        if not part:
            continue
        matched = None
        # Try exact match first
        if part in KNOWN_INSTRUMENTS:
            matched = part
        else:
            # Strip trailing digits (Violon1 -> Violon, Flute2 -> Flute)
            cleaned_no_digits = re.sub(r"\d+$", "", part)
            if cleaned_no_digits in KNOWN_INSTRUMENTS:
                matched = cleaned_no_digits
            else:
                # Strip trailing 's' (Basses -> Bass) – but only if the singular form exists
                for suffix in ["es", "s"]:
                    if cleaned_no_digits.endswith(suffix) and cleaned_no_digits[:-len(suffix)] in KNOWN_INSTRUMENTS:
                        matched = cleaned_no_digits[:-len(suffix)]
                        break

        if matched:
            normalized = INSTRUMENT_NORMALIZE.get(matched, matched)
            return [normalized]

    # Fallback: scan entire title for "for <instrument>" patterns (e.g. "Arr. for Piano 4 h.")
    title_lower = ext_stripped.lower()
    m = re.search(r"\bfor\s+([A-Za-z\s]+)\b", title_lower, re.IGNORECASE)
    if m:
        instrument_phrase = m.group(1).strip().title()
        for known in KNOWN_INSTRUMENTS:
            if instrument_phrase.startswith(known):
                normalized = INSTRUMENT_NORMALIZE.get(known, known)
                return [normalized]

    return []


def normalize_record(record: dict) -> dict:
    rec = dict(record)
    permlink = rec.get("permlink", "")
    rec["permlink"] = extract_page_title(permlink)
    # strip Category: prefix from id if present
    rec_id = rec.get("id", "")
    if isinstance(rec_id, str) and rec_id.startswith("Category:"):
        rec["id"] = rec_id[len("Category:"):]
    return rec


def serialize(obj):
    if isinstance(obj, set):
        return list(obj)
    if isinstance(obj, imslp.interfaces.internal.HashablePageRecord):
        return normalize_record(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def tokenize(text):
    if not text:
        return []
    return [t for t in text.lower().split() if t]


def extract_tag_text(tag):
    """Extracts text content from a BeautifulSoup Tag, matching imslp.scraping logic."""
    if tag is None or tag.text is None:
        return ""
    return tag.text.replace("\xa0", " ").strip()


def is_junk_result(title: str) -> bool:
    from .constants import MW_JUNK_PATTERNS
    return bool(MW_JUNK_PATTERNS.search(title))


def extract_composer_from_title(title: str) -> str:
    m = COMPOSER_FROM_TITLE.search(title)
    if m:
        return m.group(1).strip()
    return ""
