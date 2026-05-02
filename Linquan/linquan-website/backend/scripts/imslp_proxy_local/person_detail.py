import concurrent.futures
import sys

import bs4
import requests

import imslp.interfaces.constants
import imslp.interfaces.mw_api

from .constants import PERSON_DETAIL_MW_SUBCATEGORIES
from .utils import extract_tag_text


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
        tab_title = extract_tag_text(h3)
        if tab_title.startswith(subcategory):
            parent = h3.find_parent("div", class_="jq-ui-tabs")
            if not parent:
                continue

            items = []
            seen = set()
            for a in parent.find_all("a", href=True, class_="categorypagelink"):
                title = extract_tag_text(a)
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
            from .constants import COMPOSER_PATTERN
            composer_match = COMPOSER_PATTERN.search(title)
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
            from .constants import COMPOSER_PATTERN
            composer_match = COMPOSER_PATTERN.search(title)
            if composer_match:
                work_title = title[:composer_match.start()].strip()
                permlink = member_map.get(work_title.lower())

        if permlink:
            row["__link_Title"] = permlink

    return table


def _fetch_person_subcategory(subcategory: str, client, category_name: str):
    """Fetch items for a single subcategory (thread-safe for parallel use)."""
    try:
        if subcategory == "Compositions":
            items = _fetch_category_members_all(client, category_name)
        elif subcategory in PERSON_DETAIL_MW_SUBCATEGORIES:
            items = _fetch_category_members_all(client, category_name, subcategory)
        else:
            items = _fetch_subcategory_from_wiki(category_name, subcategory)
            if not items:
                items = _fetch_category_members_all(client, category_name, subcategory)
        return subcategory, items
    except Exception as e:
        print(f"Error fetching {subcategory}: {e}", file=sys.stderr)
        return subcategory, []


def action_person_detail(args: dict):
    from .utils import extract_page_title
    permlink = extract_page_title(args["permlink"])
    category_name = permlink.replace("_", " ")
    client = imslp.interfaces.mw_api.ImslpMwClient()
    tables = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=9) as executor:
        futures = {
            executor.submit(
                _fetch_person_subcategory, subcategory, client, category_name
            ): subcategory
            for subcategory in imslp.interfaces.constants.IMSLP_SUBCATEGORIES
        }
        for future in concurrent.futures.as_completed(futures):
            subcategory, items = future.result()
            if items:
                tables[subcategory] = items

    return {
        "permlink": permlink,
        "name": category_name,
        "categoryTables": tables,
    }
