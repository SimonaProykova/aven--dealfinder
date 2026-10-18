import requests
from bs4 import BeautifulSoup
import re
import json

base_url = "https://www.cocooncenter.com/marques/avene.html"
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

all_products = []
for page in range(1, 6):
    url = f"{base_url}?page={page}" if page > 1 else base_url
    resp = requests.get(url, headers=headers)
    soup = BeautifulSoup(resp.text, "html.parser")
    articles = soup.find_all("article", class_="fiche_min")
    for art in articles:
        name_tag = art.select_one("h3.bloc_nom a")
        if not name_tag:
            continue
        link = "https://www.cocooncenter.com" + name_tag.get("href", "")
        name = " ".join(name_tag.stripped_strings)
        
        ancien_tag = art.select_one(".texte_ancien_prix")
        current_tag = art.select_one(".texte_current_prix")
        pourcent_tag = art.select_one(".bloc_prix_pourcentage")
        
        reg_str = ancien_tag.get_text(strip=True) if ancien_tag else ""
        cur_str = current_tag.get_text(strip=True) if current_tag else ""
        badge_str = pourcent_tag.get_text(strip=True) if pourcent_tag else ""
        
        all_products.append({
            "name": name,
            "link": link,
            "reg_str": reg_str,
            "cur_str": cur_str,
            "badge": badge_str
        })

print(f"Total raw products: {len(all_products)}")

def parse_price(p_str):
    if not p_str:
        return None
    # e.g. "36,38 €"
    clean = re.sub(r"[^\d,.]", "", p_str).replace(",", ".")
    try:
        return float(clean)
    except:
        return None

def parse_size(name):
    # Match patterns like: "Lot de 2 x 40 ml", "2 x 100 ml", "400 ml", "50 ml", "40ml", "100 g", "1 L"
    # Lot de 2 x 40 ml
    m_mult = re.search(r"(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(ml|g|l)", name, re.IGNORECASE)
    if m_mult:
        count = float(m_mult.group(1))
        unit_val = float(m_mult.group(2).replace(",", "."))
        unit = m_mult.group(3).lower()
        if unit == "l":
            return count * unit_val * 1000
        return count * unit_val
    
    # "1 L"
    m_liter = re.search(r"(\d+(?:[.,]\d+)?)\s*l(?:\b|\s)", name, re.IGNORECASE)
    if m_liter:
        return float(m_liter.group(1).replace(",", ".")) * 1000

    m_single = re.search(r"(\d+(?:[.,]\d+)?)\s*(ml|g)", name, re.IGNORECASE)
    if m_single:
        return float(m_single.group(1).replace(",", "."))
    
    return None

def is_cream(name):
    name_l = name.lower()
    # Exclude obvious non-creams
    excludes = [
        "crème de douche", "creme de douche", "shampoing", "savon", "pain surgras", "pain",
        "eau thermale", "spray", "mousse", "gel nettoyant", "huile lavante", "stick lèvres",
        "stick levres", "mascara", "poudre", "fond de teint", "correcteur", "crayon",
        "sérum", "serum", "lotion", "eau micellaire", "gelée", "gommage", "solution",
        "démaquillant", "demaquillant", "masque", "recharge stick", "gel lacté"
    ]
    for ex in excludes:
        if ex in name_l:
            # check if it's a gift set/coffret containing cream
            if "coffret" in name_l or "trousse" in name_l or "routine" in name_l:
                return True
            return False
            
    # Include creams, balms, hydrating care
    includes = [
        "crème", "creme", "baume", "cream", "emulsion", "émulsion", "gel-crème", "gel-creme",
        "concentré apaisant", "soin regard", "contour des yeux", "crème de nuit", "crème de jour",
        "lait hydratant", "hydratant", "cicalfate", "hydrance", "tolerance", "tolérance"
    ]
    for inc in includes:
        if inc in name_l:
            return True
            
    return False

filtered = []
for p in all_products:
    if is_cream(p["name"]):
        size = parse_size(p["name"])
        cur_p = parse_price(p["cur_str"])
        reg_p = parse_price(p["reg_str"])
        
        # If no regular price was crossed out, promo price is cur_p, reg_p is cur_p
        promo_p = cur_p
        if reg_p is None:
            reg_p = cur_p
            
        discount = 0.0
        if reg_p and promo_p and reg_p > promo_p:
            discount = round((reg_p - promo_p) / reg_p * 100, 1)
        elif p["badge"] and "%" in p["badge"]:
            m_badge = re.search(r"-?(\d+)%", p["badge"])
            if m_badge:
                discount = float(m_badge.group(1))
                if reg_p == promo_p and discount > 0:
                    reg_p = round(promo_p / (1 - discount/100), 2)
                    
        price_per_100ml = None
        if promo_p and size and size > 0:
            price_per_100ml = round((promo_p / size) * 100, 2)
            
        filtered.append({
            "name": p["name"],
            "size_ml": size,
            "reg_price": reg_p,
            "promo_price": promo_p,
            "discount_pct": discount,
            "price_per_100ml": price_per_100ml,
            "link": p["link"],
            "raw_badge": p["badge"]
        })

print(f"Total creams identified: {len(filtered)}")
promos = [c for c in filtered if c["discount_pct"] > 0]
print(f"Promotional cream deals: {len(promos)}")

print("\n--- PROMOTIONAL CREAM DEALS ---")
for pr in sorted(promos, key=lambda x: -x["discount_pct"]):
    print(f"{pr['name']} | Size: {pr['size_ml']}ml | Reg: €{pr['reg_price']} | Promo: €{pr['promo_price']} | -{pr['discount_pct']}% | €{pr['price_per_100ml']}/100ml")
