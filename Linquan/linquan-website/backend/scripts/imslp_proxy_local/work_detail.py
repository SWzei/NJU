import concurrent.futures
import json
import urllib.parse

import bs4
import requests

import imslp.interfaces.mw_api
from imslp.interfaces.scraping import IMSLP_REGEXP_RATINGS, IMSLP_REGEXP_PAGE_COUNT

from .constants import IMSLP_WIKI_PREFIX
from .utils import extract_page_title, extract_instruments_from_file_title


def _fetch_images_metadata_fast(page):
    """
    Optimized version of fetch_images_metadata.
    Pre-builds lookup tables from the HTML DOM so each image lookup is O(1)
    instead of O(n) BeautifulSoup scans.

    Parallelizes the two independent network calls (HTTP HTML fetch +
    mwclient image listing) to reduce total latency.
    """
    if page is None:
        return []

    esc_title = urllib.parse.quote(page.base_title.replace(" ", "_"))
    u = f"{IMSLP_WIKI_PREFIX}{esc_title}"

    def _fetch_html():
        try:
            resp = requests.get(
                u,
                headers={"User-Agent": "Mozilla/5.0 (compatible; LinquanBot/1.0)"},
                timeout=30,
            )
            return resp if resp.ok else None
        except Exception:
            return None

    def _fetch_image_list():
        try:
            return list(page.images())
        except Exception:
            return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        html_future = executor.submit(_fetch_html)
        images_future = executor.submit(_fetch_image_list)
        r = html_future.result()
        all_images = images_future.result()

    if r is None:
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
    for f in all_images:
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
    permlink = extract_page_title(args["permlink"])
    client = imslp.interfaces.mw_api.ImslpMwClient()
    page = client.pages[permlink]
    images = _fetch_images_metadata_fast(page)
    # Remove non-serializable mwclient.image.Image objects
    for img in images:
        img.pop("obj", None)
        # Extract instrument labels from the file title
        img["instruments"] = extract_instruments_from_file_title(img.get("title", ""))
    return {
        "permlink": permlink,
        "title": page.base_title,
        "images": images,
    }
