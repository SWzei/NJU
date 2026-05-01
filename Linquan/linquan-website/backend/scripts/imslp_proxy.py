#!/usr/bin/env python3
"""
IMSLP Python proxy for Node.js backend.
Runs as a long-lived process. Reads line-delimited JSON requests from stdin
and writes line-delimited JSON responses to stdout.
"""

import json
import os
import re
import sys
import traceback
import urllib.parse

import bs4
import requests

import imslp.client
import imslp.interfaces.constants
import imslp.interfaces.internal
import imslp.interfaces.mw_api
import imslp.interfaces.scraping
from imslp.interfaces.scraping import IMSLP_REGEXP_RATINGS, IMSLP_REGEXP_PAGE_COUNT

IMSLP_WIKI_PREFIX = "https://imslp.org/wiki/"

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")


def _load_local_cache():
    works_path = os.path.join(CACHE_DIR, "imslp_works_cache.json")
    people_path = os.path.join(CACHE_DIR, "imslp_people_cache.json")
    if os.path.exists(works_path):
        try:
            with open(works_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            imslp.interfaces.internal._cache_works = [
                imslp.interfaces.internal.HashablePageRecord(r) for r in data
            ]
            print(f"Loaded {len(data)} works from local cache", file=sys.stderr)
        except Exception as e:
            print(f"Failed to load works cache: {e}", file=sys.stderr)
    if os.path.exists(people_path):
        try:
            with open(people_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            imslp.interfaces.internal._cache_people = [
                imslp.interfaces.internal.HashablePageRecord(r) for r in data
            ]
            print(f"Loaded {len(data)} people from local cache", file=sys.stderr)
        except Exception as e:
            print(f"Failed to load people cache: {e}", file=sys.stderr)


_load_local_cache()


def _extract_page_title(permlink: str) -> str:
    if permlink.startswith(IMSLP_WIKI_PREFIX):
        permlink = permlink[len(IMSLP_WIKI_PREFIX):]
    # Strip Category: prefix for person pages
    if permlink.startswith("Category:"):
        permlink = permlink[len("Category:"):]
    return permlink


# Known instrument / part names that appear at the end of IMSLP file titles.
# Includes common English, French, and German variants.
_KNOWN_INSTRUMENTS = {
    # Common English names
    "Piano", "Organ", "Harpsichord", "Clavichord", "Celesta",
    "Violin", "Viola", "Cello", "Bass", "Contrabass", "Double Bass",
    "Flute", "Piccolo", "Oboe", "English Horn", "Cor Anglais",
    "Clarinet", "Bass Clarinet", "Bassoon", "Contrabassoon",
    "Horn", "HornF", "Trumpet", "Cornet", "Trombone", "Tuba",
    "Euphonium", "Baritone", "Saxophone", "Saxhorn",
    "Harp", "Guitar", "Mandolin", "Banjo", "Lute",
    "Timpani", "Percussion", "Drums", "Cymbals", "Triangle",
    "Soprano", "Mezzo", "Alto", "Tenor", "Baritone", "Bass",
    "Voice", "Choir", "Chorus",
    # French variants (common in IMSLP orchestral parts)
    "Violon", "Violoncelle", "Violon1", "Violon2",
    "Hautbois", "Hautbois1", "Hautbois2",
    "Clarinette", "Clarinette1", "Clarinette2",
    "Basson", "Basson1", "Basson2",
    "Cor", "Cor1", "Cor2", "Cor3", "Cor4",
    "Trompette", "Trompette1", "Trompette2",
    "Trombone1", "Trombone2", "Trombone3",
    "Timbales", "Timbales1",
    "Contrebasse", "Contrebasses", "Basses",
    "Flute1", "Flute2", "Flute3",
    "Piccolo1", "Piccolo2",
    # German variants
    "Violine", "Bratsche", "Violoncell", "Kontrabass",
    "Flote", "Oboe", "Klarinette", "Fagott",
    "Horn", "Trompete", "Posaune", "Tuba",
    "Pauken",
    # Other common IMSLP labels
    "Score", "Part", "Parts", "Full Score", "Miniature Score",
    "Vocal Score", "Piano Score",
    # Misc
    "Cello1", "Cello2",
    "Violin1", "Violin2", "Violin3",
    "Viola1", "Viola2",
}

# Normalize matched instrument variants to English display names.
_INSTRUMENT_NORMALIZE = {
    "Violon": "Violin", "Violon1": "Violin", "Violon2": "Violin",
    "Hautbois": "Oboe", "Hautbois1": "Oboe", "Hautbois2": "Oboe",
    "Clarinette": "Clarinet", "Clarinette1": "Clarinet", "Clarinette2": "Clarinet",
    "Basson": "Bassoon", "Basson1": "Bassoon", "Basson2": "Bassoon",
    "Cor": "Horn", "Cor1": "Horn", "Cor2": "Horn", "Cor3": "Horn", "Cor4": "Horn",
    "Trompette": "Trumpet", "Trompette1": "Trumpet", "Trompette2": "Trumpet",
    "Trombone1": "Trombone", "Trombone2": "Trombone", "Trombone3": "Trombone",
    "Timbales": "Timpani", "Timbales1": "Timpani",
    "Contrebasse": "Bass", "Contrebasses": "Bass", "Basses": "Bass",
    "HornF": "Horn",
    "Flute1": "Flute", "Flute2": "Flute", "Flute3": "Flute",
    "Piccolo1": "Piccolo", "Piccolo2": "Piccolo",
    "Violoncelle": "Cello",
    "Violine": "Violin", "Bratsche": "Viola", "Violoncell": "Cello",
    "Kontrabass": "Bass",
    "Flote": "Flute", "Klarinette": "Clarinet", "Fagott": "Bassoon",
    "Trompete": "Trumpet", "Posaune": "Trombone",
    "Pauken": "Timpani",
}


def _extract_instruments_from_file_title(title: str) -> list:
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
        if part in _KNOWN_INSTRUMENTS:
            matched = part
        else:
            # Strip trailing digits (Violon1 -> Violon, Flute2 -> Flute)
            cleaned_no_digits = re.sub(r"\d+$", "", part)
            if cleaned_no_digits in _KNOWN_INSTRUMENTS:
                matched = cleaned_no_digits
            else:
                # Strip trailing 's' (Basses -> Bass) – but only if the singular form exists
                for suffix in ["es", "s"]:
                    if cleaned_no_digits.endswith(suffix) and cleaned_no_digits[:-len(suffix)] in _KNOWN_INSTRUMENTS:
                        matched = cleaned_no_digits[:-len(suffix)]
                        break

        if matched:
            normalized = _INSTRUMENT_NORMALIZE.get(matched, matched)
            return [normalized]

    # Fallback: scan entire title for "for <instrument>" patterns (e.g. "Arr. for Piano 4 h.")
    title_lower = ext_stripped.lower()
    m = re.search(r"\bfor\s+([A-Za-z\s]+)\b", title_lower, re.IGNORECASE)
    if m:
        instrument_phrase = m.group(1).strip().title()
        for known in _KNOWN_INSTRUMENTS:
            if instrument_phrase.startswith(known):
                normalized = _INSTRUMENT_NORMALIZE.get(known, known)
                return [normalized]

    return []


def _normalize_record(record: dict) -> dict:
    rec = dict(record)
    permlink = rec.get("permlink", "")
    rec["permlink"] = _extract_page_title(permlink)
    # strip Category: prefix from id if present
    rec_id = rec.get("id", "")
    if isinstance(rec_id, str) and rec_id.startswith("Category:"):
        rec["id"] = rec_id[len("Category:"):]
    return rec


def _serialize(obj):
    if isinstance(obj, set):
        return list(obj)
    if isinstance(obj, imslp.interfaces.internal.HashablePageRecord):
        return _normalize_record(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _tokenize(text):
    if not text:
        return []
    return [t for t in text.lower().split() if t]


def _score_field(query_tokens, field_value):
    """计算一组搜索词在单个字段上的匹配情况。
    返回 (匹配词数, 分数)。分数越高表示匹配质量越好。"""
    if not field_value:
        return 0, 0
    field_lower = field_value.lower()
    matched = 0
    score = 0
    for token in query_tokens:
        if not token:
            continue
        if token == field_lower:
            matched += 1
            score += 100
        elif re.search(r'\b' + re.escape(token) + r'\b', field_lower):
            matched += 1
            score += 50
        elif field_lower.startswith(token):
            matched += 1
            score += 20
        elif token in field_lower:
            matched += 1
            score += 10
    return matched, score


def _smart_search_works(title, composer, limit=100):
    """乐谱搜索：分词匹配 + 跨字段搜索 + 按相关性排序。"""
    records = list(imslp.interfaces.internal.list_works())
    title_tokens = _tokenize(title)
    composer_tokens = _tokenize(composer)
    all_tokens = title_tokens + composer_tokens

    if not all_tokens:
        return records[:limit]

    scored = []
    for rec in records:
        worktitle = rec.get("intvals", {}).get("worktitle", "") or ""
        comp = rec.get("intvals", {}).get("composer", "") or ""
        permlink = rec.get("permlink", "") or ""
        rec_id = rec.get("id", "") or ""

        # title 关键词可以匹配 worktitle、permlink 或 id
        t_m1, t_s1 = _score_field(title_tokens, worktitle)
        t_m2, t_s2 = _score_field(title_tokens, permlink)
        t_m3, t_s3 = _score_field(title_tokens, rec_id)
        title_matched = max(t_m1, t_m2, t_m3)
        title_score = max(t_s1, t_s2, t_s3)

        # composer 关键词可以匹配 composer 字段、worktitle、permlink 或 id
        c_m1, c_s1 = _score_field(composer_tokens, comp)
        c_m2, c_s2 = _score_field(composer_tokens, worktitle)
        c_m3, c_s3 = _score_field(composer_tokens, permlink)
        c_m4, c_s4 = _score_field(composer_tokens, rec_id)
        comp_matched = max(c_m1, c_m2, c_m3, c_m4)
        comp_score = max(c_s1, c_s2, c_s3, c_s4)

        total_matched = title_matched + comp_matched
        total_score = title_score + comp_score

        # 加分项：关键词命中了"正确"的字段
        if title_tokens and t_m1 == len(title_tokens):
            total_score += 30
        if composer_tokens and c_m1 == len(composer_tokens):
            total_score += 30

        # 要求所有搜索词都必须在某处匹配到（跨字段也可）
        if total_matched >= len(all_tokens):
            scored.append((total_score, rec))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:limit]]


def _smart_search_people(name, limit=100):
    """人物搜索：分词匹配 + 按相关性排序。"""
    records = list(imslp.interfaces.internal.list_people())
    tokens = _tokenize(name)

    if not tokens:
        return records[:limit]

    scored = []
    for rec in records:
        rec_id = rec.get("id", "") or ""
        permlink = rec.get("permlink", "") or ""

        m1, s1 = _score_field(tokens, rec_id)
        m2, s2 = _score_field(tokens, permlink)

        total_matched = max(m1, m2)
        total_score = max(s1, s2)

        if total_matched >= len(tokens):
            scored.append((total_score, rec))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:limit]]


# 明显不相关的页面标题关键词
_MW_JUNK_PATTERNS = re.compile(
    r'^(Wishlist|List of works|List of Compositions|List of Intermediate|'
    r'List of Easy|List of Difficult|List of)|\b(Plates|Durand|Heugel|'
    r'Augener|Breitkopf|Schott|Henle|Peters)\b',
    re.IGNORECASE,
)

# 从 IMSLP 标题中提取 composer，格式如: "Work Title (Beethoven, Ludwig van)"
_COMPOSER_FROM_TITLE = re.compile(r'\(([^,)]+,\s*[^)]+)\)$')


def _is_junk_result(title: str) -> bool:
    return bool(_MW_JUNK_PATTERNS.search(title))


def _extract_composer_from_title(title: str) -> str:
    m = _COMPOSER_FROM_TITLE.search(title)
    if m:
        return m.group(1).strip()
    return ""


def _score_mw_result(item, title_tokens, composer_tokens):
    """给 MediaWiki fallback 结果打分，用于排序。"""
    wt = item.get("intvals", {}).get("worktitle", "").lower()
    comp = item.get("intvals", {}).get("composer", "").lower()
    score = 0

    # title 词匹配 worktitle
    for t in title_tokens:
        if not t:
            continue
        if re.search(r'\b' + re.escape(t) + r'\b', wt):
            score += 50
        elif t in wt:
            score += 10

    # composer 词匹配 composer 或 worktitle
    for c in composer_tokens:
        if not c:
            continue
        if re.search(r'\b' + re.escape(c) + r'\b', comp):
            score += 50
        elif c in comp:
            score += 10
        elif re.search(r'\b' + re.escape(c) + r'\b', wt):
            score += 20
        elif c in wt:
            score += 5

    # 惩罚垃圾结果
    if _is_junk_result(wt):
        score -= 200

    return score


def _mw_search(query: str, is_work: bool = True, limit: int = 20):
    client = imslp.interfaces.mw_api.ImslpMwClient()
    results = []
    seen = set()
    ns = 0 if is_work else 14
    try:
        for item in client.search(query, namespace=ns, what="text", limit=limit):
            title = item.get("title", "")
            if not is_work and title.startswith("Category:"):
                title = title[len("Category:"):]
            if _is_junk_result(title):
                continue
            permlink = title.replace(" ", "_")
            if permlink in seen:
                continue
            seen.add(permlink)
            composer = _extract_composer_from_title(title) if is_work else ""
            results.append({
                "id": title,
                "permlink": permlink,
                "intvals": {
                    "worktitle": title if is_work else "",
                    "composer": composer,
                },
            })
    except Exception:
        pass
    return results


def _mw_search_multi(queries, title_tokens, composer_tokens, is_work=True, limit=20):
    """用多个查询词分别搜索 MediaWiki，合并去重后按相关性排序返回。"""
    all_results = []
    seen = set()
    for q in queries:
        if not q:
            continue
        for item in _mw_search(q, is_work=is_work, limit=limit):
            if item["permlink"] not in seen:
                seen.add(item["permlink"])
                all_results.append(item)
        if len(all_results) >= limit * 2:
            break

    # 按相关性排序
    scored = [
        (_score_mw_result(item, title_tokens, composer_tokens), item)
        for item in all_results
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


def action_search_works(args: dict):
    title = args.get("title") or None
    composer = args.get("composer") or None
    results = _smart_search_works(title=title, composer=composer, limit=100)
    items = [_normalize_record(r) for r in results]

    title_tokens = _tokenize(title)
    composer_tokens = _tokenize(composer)

    # Fallback to MediaWiki search if cache-based search yields nothing or very few results
    if len(items) < 5 and (title or composer):
        queries = []
        if composer and title:
            queries.append(f"{composer} {title}")
        if title:
            queries.append(title)
        if composer:
            queries.append(composer)
        fallback_items = _mw_search_multi(
            queries,
            title_tokens=title_tokens,
            composer_tokens=composer_tokens,
            is_work=True,
            limit=20,
        )
        # Merge and deduplicate
        seen = {item["permlink"] for item in items}
        for item in fallback_items:
            if item["permlink"] not in seen:
                seen.add(item["permlink"])
                items.append(item)

    return {"items": items}


def action_search_people(args: dict):
    name = args.get("name") or None
    results = _smart_search_people(name=name, limit=100)
    items = [_normalize_record(r) for r in results]

    if len(items) < 5 and name:
        tokens = _tokenize(name)
        fallback_items = _mw_search_multi(
            [name],
            title_tokens=[],
            composer_tokens=tokens,
            is_work=False,
            limit=20,
        )
        seen = {item["permlink"] for item in items}
        for item in fallback_items:
            if item["permlink"] not in seen:
                seen.add(item["permlink"])
                items.append(item)

    return {"items": items}


def action_list_works(args: dict):
    start = args.get("start", 0)
    count = args.get("count")
    cache = args.get("cache", True)
    results = imslp.interfaces.internal.list_works(start=start, count=count, cache=cache)
    return {"items": [_normalize_record(r) for r in results]}


def action_list_people(args: dict):
    start = args.get("start", 0)
    count = args.get("count")
    cache = args.get("cache", True)
    results = imslp.interfaces.internal.list_people(start=start, count=count, cache=cache)
    return {"items": [_normalize_record(r) for r in results]}


def _fetch_images_metadata_fast(page):
    """
    Optimized version of fetch_images_metadata.
    Pre-builds lookup tables from the HTML DOM so each image lookup is O(1)
    instead of O(n) BeautifulSoup scans.
    """
    if page is None:
        return []

    esc_title = urllib.parse.quote(page.base_title.replace(" ", "_"))
    u = f"https://imslp.org/wiki/{esc_title}"

    r = requests.get(
        u,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LinquanBot/1.0)"},
        timeout=30,
    )
    if not r.ok:
        return []

    s = bs4.BeautifulSoup(r.content, features="html.parser")

    # Parse ratings from embedded JavaScript
    ratings_dict = {}
    m = IMSLP_REGEXP_RATINGS.search(s.__str__())
    if m is not None:
        try:
            old = json.loads(m.group(1))
            for key, value in old.items():
                try:
                    ratings_dict[int(key)] = {
                        "rating": value[0],
                        "count": int(value[1]),
                    }
                except (ValueError, IndexError):
                    continue
        except json.JSONDecodeError:
            pass

    # Pre-build lookup tables from all <a> tags in a single pass
    href_map = {}
    title_map = {}
    counter_map = {}

    for a in s.find_all("a", href=True):
        href = a["href"]
        a_title = a.get("title", "")

        # File links
        if href.startswith("/wiki/File:"):
            # Prefer elements with non-empty text to avoid empty-text overrides
            if href not in href_map or not href_map[href].text.strip():
                href_map[href] = a
            if a_title.startswith("File:"):
                if a_title not in title_map or not title_map[a_title].text.strip():
                    title_map[a_title] = a

        # Download counter links: /wiki/Special:GetFCtrStats/@123
        if href.startswith("/wiki/Special:GetFCtrStats/@"):
            try:
                fid = int(href.split("@")[-1])
                counter_map[fid] = int(a.text.strip())
            except ValueError:
                pass

    images = []
    for f in page.images():
        f_title = f.base_title
        f_esc_title = urllib.parse.quote(f_title.replace(" ", "_"))

        # O(1) lookup instead of s.find() DOM scan
        elem = href_map.get(f"/wiki/File:{f_esc_title}") or title_map.get(f"File:{f_title}")
        if elem is None:
            continue

        text = elem.text.strip()
        if not text:
            continue

        try:
            file_id = int(text.replace("#", ""))
        except ValueError:
            continue

        file_counter = counter_map.get(file_id)
        if file_counter is None:
            continue

        # Extract page count from parent text
        page_count = None
        parent_text = elem.parent.text if elem.parent else ""
        pcm = IMSLP_REGEXP_PAGE_COUNT.search(parent_text)
        if pcm is not None:
            try:
                page_count = int(pcm.group(1))
            except ValueError:
                pass

        # Fix image URL
        url = f.imageinfo.get("url", "")
        if url.startswith("/"):
            url = "http:" + url

        images.append({
            "id": file_id,
            "rating": ratings_dict.get(file_id, {}).get("rating", -1),
            "rating_count": ratings_dict.get(file_id, {}).get("count", 0),
            "download_count": file_counter,
            "title": f_title,
            "url": url,
            "page_count": page_count,
            "size": f.imageinfo.get("size"),
            "sha1": f.imageinfo.get("sha1"),
        })

    return images


def action_work_detail(args: dict):
    permlink = _extract_page_title(args["permlink"])
    client = imslp.interfaces.mw_api.ImslpMwClient()
    page = client.pages[permlink]
    images = _fetch_images_metadata_fast(page)
    # Remove non-serializable mwclient.image.Image objects
    for img in images:
        img.pop("obj", None)
        # Extract instrument labels from the file title
        img["instruments"] = _extract_instruments_from_file_title(img.get("title", ""))
    return {
        "permlink": permlink,
        "title": page.base_title,
        "images": images,
    }


def _extract_tag_text(tag: bs4.element.Tag) -> str:
    """Extracts text content from a BeautifulSoup Tag, matching imslp.scraping logic."""
    if tag is None or tag.text is None:
        return ""
    return tag.text.replace("\xa0", " ").strip()


def _fetch_subcategory_from_wiki(category_name: str, subcategory: str):
    """
    Scrape the IMSLP wiki Category page for a specific subcategory tab.
    Used for subcategories that do not exist as real MediaWiki categories
    (e.g., 'As Arranger', 'As Copyist', 'As Dedicatee', 'As Editor').
    """
    cat_permlink = category_name.replace(" ", "_")
    url = f"https://imslp.org/wiki/Category:{cat_permlink}"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; LinquanBot/1.0)"}

    try:
        r = requests.get(url, headers=headers, timeout=30)
        if not r.ok:
            return []
    except Exception:
        return []

    s = bs4.BeautifulSoup(r.content, features="html.parser")

    for h3 in s.find_all("h3", class_="nojs"):
        tab_title = _extract_tag_text(h3)
        if tab_title.startswith(subcategory):
            parent = h3.find_parent("div", class_="jq-ui-tabs")
            if not parent:
                continue

            items = []
            seen = set()
            for a in parent.find_all("a", href=True, class_="categorypagelink"):
                title = _extract_tag_text(a)
                href = a.get("href", "")
                if not title or not href.startswith("/wiki/"):
                    continue
                if title in seen:
                    continue
                seen.add(title)
                permlink = title.replace(" ", "_")
                items.append({"Title": title, "__link_Title": permlink})
            return items

    return []


def _fetch_category_members_all(client, category_name: str, subcategory: str = None):
    """Fetch all members of a MediaWiki category via mwclient (handles pagination)."""
    cat = f"Category:{category_name}"
    if subcategory:
        cat += f"/{subcategory}"
    try:
        page = client.pages[cat]
        members = []
        seen = set()
        for member in page.members():
            title = member.name if hasattr(member, "name") else str(member)
            if title.startswith("Category:"):
                continue
            if title in seen:
                continue
            seen.add(title)
            permlink = title.replace(" ", "_")
            members.append({"Title": title, "__link_Title": permlink})
        return members
    except Exception:
        return []


_COMPOSER_PATTERN = re.compile(r'\s*\([^)]+\)$')


def _enrich_table_with_links(table, client, category_name, subcategory=None):
    """为 fetch_category_table 返回的表格中的 Title 列补充 permlink 链接。"""
    if not table:
        return table

    cat = f"Category:{category_name}"
    if subcategory:
        cat += f"/{subcategory}"

    try:
        page = client.pages[cat]
        member_map = {}
        for member in page.members():
            title = member.name if hasattr(member, "name") else str(member)
            if title.startswith("Category:"):
                continue
            permlink = title.replace(" ", "_")
            member_map[title.lower()] = permlink
            # 也建立去掉作曲家后缀后的映射
            composer_match = _COMPOSER_PATTERN.search(title)
            if composer_match:
                work_title = title[:composer_match.start()].strip()
                member_map[work_title.lower()] = permlink
    except Exception:
        return table

    for row in table:
        title = row.get("Title", "")
        if not title:
            continue

        permlink = member_map.get(title.lower())

        # 如果没有直接匹配，尝试从标题中去掉作曲家后缀再匹配
        if not permlink:
            composer_match = _COMPOSER_PATTERN.search(title)
            if composer_match:
                work_title = title[:composer_match.start()].strip()
                permlink = member_map.get(work_title.lower())

        if permlink:
            row["__link_Title"] = permlink

    return table


def action_person_detail(args: dict):
    permlink = _extract_page_title(args["permlink"])
    category_name = permlink.replace("_", " ")
    tables = {}
    client = imslp.interfaces.mw_api.ImslpMwClient()

    # Subcategories that exist as real MediaWiki sub-categories
    _MW_SUBCATEGORIES = {"Collections", "Collaborations", "Books", "Pasticcios"}

    for subcategory in imslp.interfaces.constants.IMSLP_SUBCATEGORIES:
        items = []

        if subcategory == "Compositions":
            # Compositions = all members of the main category (mwclient handles pagination)
            items = _fetch_category_members_all(client, category_name)
        elif subcategory in _MW_SUBCATEGORIES:
            # These have real MediaWiki sub-categories
            items = _fetch_category_members_all(client, category_name, subcategory)
        else:
            # As Arranger / As Copyist / As Dedicatee / As Editor
            # These do NOT have MediaWiki sub-categories; scrape the wiki page instead.
            items = _fetch_subcategory_from_wiki(category_name, subcategory)
            # Fallback: try MediaWiki sub-category just in case IMSLP adds it later
            if not items:
                items = _fetch_category_members_all(client, category_name, subcategory)

        if items:
            tables[subcategory] = items

    return {
        "permlink": permlink,
        "name": category_name,
        "categoryTables": tables,
    }


ACTIONS = {
    "search_works": action_search_works,
    "search_people": action_search_people,
    "list_works": action_list_works,
    "list_people": action_list_people,
    "work_detail": action_work_detail,
    "person_detail": action_person_detail,
}


def handle_request(req: dict):
    action = req.get("action")
    args = req.get("args", {})
    handler = ACTIONS.get(action)
    if not handler:
        return {"ok": False, "error": f"Unknown action: {action}"}
    try:
        result = handler(args)
        return {"ok": True, "data": result}
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        return {"ok": False, "error": str(e)}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            resp = {"ok": False, "error": f"Invalid JSON: {e}"}
            print(json.dumps(resp))
            sys.stdout.flush()
            continue

        resp = handle_request(req)
        print(json.dumps(resp, default=_serialize))
        sys.stdout.flush()


if __name__ == "__main__":
    main()
