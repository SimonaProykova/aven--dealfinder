#!/usr/bin/env python3
"""
Automated Web Scraper & Data Analysis Script for Avène Promotional Deals
Target Brand: Eau Thermale Avène
Product Category: Face & Body Creams
"""

import sys
import re
import json
import logging
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Target pharmacy URL (Cocooncenter - authentic European parapharmacy selling Avène in €)
TARGET_BASE_URL = "https://www.cocooncenter.com/marques/avene.html"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

OUTPUT_JSON_PATH = "avene_deals.json"

EXCLUDE_KEYWORDS = [
    "crème de douche", "creme de douche", "crème lavante", "creme lavante",
    "shampoing", "shampooing", "savon", "pain surgras", "pain",
    "eau thermale", "spray", "mousse", "gel nettoyant", "huile lavante",
    "stick lèvres", "stick levres", "mascara", "poudre", "fond de teint",
    "correcteur", "crayon", "pinceau", "sérum", "serum", "lotion",
    "eau micellaire", "gelée", "gommage", "solution", "démaquillant",
    "demaquillant", "masque", "recharge stick", "gel lacté", "gel autobronzant",
    "gel cicatrice", "baume lèvres", "baume levres"
]

CREAM_KEYWORDS = [
    "crème", "creme", "baume", "cream", "emulsion", "émulsion",
    "gel-crème", "gel-creme", "concentré apaisant", "lait hydratant",
    "soin regard", "contour des yeux", "crème de nuit", "crème de jour",
    "crème riche", "crème légère", "crème réparatrice", "hydratant"
]


def parse_price(price_str: Optional[str]) -> Optional[float]:
    """Parse a European price string like '36,38 €' into a float 36.38."""
    if not price_str:
        return None
    cleaned = re.sub(r"[^\d,.]", "", price_str).replace(",", ".")
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def parse_volume_ml(product_name: str) -> Optional[float]:
    """
    Extract product volume in ml from product name.
    Handles 'Lot de 2 x 40 ml', '400 ml', '50ml', '100 g', '1 L'.
    """
    # Check multipack: e.g. "2 x 40 ml" or "Lot de 2 x 50 ml"
    m_multi = re.search(r"(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(ml|g|l)", product_name, re.IGNORECASE)
    if m_multi:
        count = float(m_multi.group(1))
        val = float(m_multi.group(2).replace(",", "."))
        unit = m_multi.group(3).lower()
        if unit == "l":
            return round(count * val * 1000, 1)
        return round(count * val, 1)

    # Check Liters: e.g. "1 L"
    m_liters = re.search(r"(\d+(?:[.,]\d+)?)\s*l(?:\b|\s)", product_name, re.IGNORECASE)
    if m_liters:
        return round(float(m_liters.group(1).replace(",", ".")) * 1000, 1)

    # Check standard ml or g: e.g. "40 ml", "100 g"
    m_single = re.search(r"(\d+(?:[.,]\d+)?)\s*(ml|g)", product_name, re.IGNORECASE)
    if m_single:
        return round(float(m_single.group(1).replace(",", ".")), 1)

    return None


def is_cream_product(name: str) -> bool:
    """Filter to ensure product is a face or body cream."""
    name_lower = name.lower()

    # Allow gift sets / routine boxes if they contain cream
    is_gift_set = any(k in name_lower for k in ["coffret", "trousse", "routine"])
    if not is_gift_set:
        for exc in EXCLUDE_KEYWORDS:
            if exc in name_lower:
                return False

    # Check for cream descriptors
    return any(ck in name_lower for ck in CREAM_KEYWORDS)


def scrape_all_pages(base_url: str = TARGET_BASE_URL) -> List[Dict[str, Any]]:
    """Scrape all pagination pages from the target Avène brand section."""
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # Determine total pages
    logger.info(f"Connecting to target catalog: {base_url}")
    resp = session.get(base_url, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    page_links = [a.get("href") for a in soup.find_all("a", href=True) if "page=" in a.get("href")]
    pages = [int(re.search(r"page=(\d+)", href).group(1)) for href in page_links if re.search(r"page=(\d+)", href)]
    max_page = max(pages) if pages else 1
    logger.info(f"Discovered {max_page} catalog pages.")

    all_raw_items = []

    for page_num in range(1, max_page + 1):
        page_url = f"{base_url}?page={page_num}" if page_num > 1 else base_url
        logger.info(f"Scraping Page {page_num}/{max_page} ({page_url})...")
        r = session.get(page_url, timeout=15)
        r.raise_for_status()
        p_soup = BeautifulSoup(r.text, "html.parser")

        articles = p_soup.find_all("article", class_="fiche_min")
        logger.info(f"Page {page_num}: Found {len(articles)} product listings.")

        for art in articles:
            name_tag = art.select_one("h3.bloc_nom a")
            if not name_tag:
                continue

            full_name = " ".join(name_tag.stripped_strings)
            rel_link = name_tag.get("href", "")
            direct_link = f"https://www.cocooncenter.com{rel_link}" if rel_link.startswith("/") else rel_link

            ancien_tag = art.select_one(".texte_ancien_prix")
            current_tag = art.select_one(".texte_current_prix")
            pourcent_tag = art.select_one(".bloc_prix_pourcentage")

            reg_price_str = ancien_tag.get_text(strip=True) if ancien_tag else ""
            cur_price_str = current_tag.get_text(strip=True) if current_tag else ""
            badge_str = pourcent_tag.get_text(strip=True) if pourcent_tag else ""

            all_raw_items.append({
                "product_name": full_name,
                "direct_link": direct_link,
                "raw_regular_price": reg_price_str,
                "raw_current_price": cur_price_str,
                "promo_badge": badge_str
            })

    logger.info(f"Successfully extracted {len(all_raw_items)} total raw Avène products.")
    return all_raw_items


def process_and_filter(raw_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Filter for creams, calculate discounts, unit prices, and savings."""
    all_creams = []
    promotional_deals = []

    for item in raw_items:
        name = item["product_name"]
        if not is_cream_product(name):
            continue

        size_ml = parse_volume_ml(name)
        cur_price = parse_price(item["raw_current_price"])
        reg_price = parse_price(item["raw_regular_price"])

        promo_price = cur_price
        has_discount = False

        if reg_price is not None and cur_price is not None and reg_price > cur_price:
            has_discount = True
        else:
            reg_price = cur_price

        # Calculate discount percentage
        discount_pct = 0.0
        if has_discount and reg_price and promo_price:
            discount_pct = round(((reg_price - promo_price) / reg_price) * 100.0, 1)
        elif item["promo_badge"] and "%" in item["promo_badge"]:
            m_badge = re.search(r"-?(\d+)%", item["promo_badge"])
            if m_badge:
                discount_pct = float(m_badge.group(1))
                has_discount = True
                if reg_price == promo_price and discount_pct > 0 and promo_price:
                    reg_price = round(promo_price / (1.0 - (discount_pct / 100.0)), 2)

        # Calculate unit price per 100ml
        price_per_100ml = None
        if promo_price and size_ml and size_ml > 0:
            price_per_100ml = round((promo_price / size_ml) * 100.0, 2)

        actual_savings = round(reg_price - promo_price, 2) if (reg_price and promo_price) else 0.0

        processed_item = {
            "product_name": name,
            "size_ml": size_ml,
            "regular_price_eur": reg_price,
            "promo_price_eur": promo_price,
            "savings_eur": actual_savings,
            "discount_pct": discount_pct,
            "price_per_100ml_eur": price_per_100ml,
            "direct_link": item["direct_link"],
            "promo_badge": item["promo_badge"],
            "is_on_promotion": has_discount
        }

        all_creams.append(processed_item)
        if has_discount:
            promotional_deals.append(processed_item)

    # Sort promotional deals by discount percentage descending, then price per 100ml ascending
    promotional_deals.sort(
        key=lambda x: (-x["discount_pct"], x["price_per_100ml_eur"] if x["price_per_100ml_eur"] is not None else 9999)
    )

    return {
        "total_scraped": len(raw_items),
        "total_creams": len(all_creams),
        "total_promotions": len(promotional_deals),
        "promotional_deals": promotional_deals,
        "all_creams": all_creams
    }


def main():
    logger.info("Starting Avène Promotional Deal Scraper...")
    raw_products = scrape_all_pages(TARGET_BASE_URL)
    result_data = process_and_filter(raw_products)

    # Save to JSON
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved complete dataset to {OUTPUT_JSON_PATH}")

    deals = result_data["promotional_deals"]
    logger.info(f"Found {len(deals)} active promotional deals on Avène creams.")
    print(f"\nSuccessfully identified {len(deals)} promotional deals out of {result_data['total_creams']} Avène creams.")


if __name__ == "__main__":
    main()
