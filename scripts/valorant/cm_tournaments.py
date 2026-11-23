#!/usr/bin/env python3
"""Lista torneos de Challengermode que solo se ven con JavaScript.

Las páginas de listado (general de VALORANT y la de cada organizador) se arman con
JavaScript, así que se abren con Chrome sin pantalla (--dump-dom). De cada tarjeta sale
el enlace y su texto ("Hosted by X • Latin America • 2v2 • premios • 128 slots • Open");
luego se completa con el JSON-LD de la página del torneo (fecha UTC, cupos, gratis).

Uso (lo corre la rutina de torneos):
  python3 scripts/valorant/cm_tournaments.py > /tmp/cm.json
  python3 scripts/valorant/cm_tournaments.py --html pagina.html   # sin Chrome (pruebas)

Solo usa la biblioteca estándar. Variable CHROME para otra ruta del navegador.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser

BASE = "https://www.challengermode.com"
LIST_PAGES = [
    f"{BASE}/valorant/tournaments?state=upcoming",
    f"{BASE}/s/LEVIATAN/tournaments",
]
LINK_RE = re.compile(r"^/s/[^/]+/tournaments/[0-9a-f-]{36}$")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
UA = "Mozilla/5.0 (compatible; TLH-torneos/1.0)"


class Node:
    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.children, self.parent = tag, dict(attrs), [], parent

    def text(self):
        out = []
        stack = [self]
        while stack:
            n = stack.pop()
            if isinstance(n, str):
                out.append(n)
            elif n.tag not in ("script", "style"):
                stack.extend(reversed(n.children))
        return re.sub(r"\s+", " ", " ".join(out)).strip()


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", [], None)
        self.cur = self.root
        self.links = []

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if tag == "a" and LINK_RE.match(node.attrs.get("href") or ""):
            self.links.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        if data.strip():
            self.cur.children.append(data)


def cards_from_html(html):
    """{href: texto de la tarjeta} para cada enlace a un torneo."""
    tb = TreeBuilder()
    tb.feed(html)
    cards = {}
    for a in tb.links:
        href = a.attrs["href"]
        n, best = a, ""
        # Sube hasta el contenedor de la tarjeta (el que ya incluye "Hosted by"), sin pasarse a la lista entera.
        for _ in range(10):
            if n.parent is None:
                break
            n = n.parent
            t = n.text()
            if len(re.findall(r"/tournaments/|Hosted by", t)) > 1 and best:
                break
            if "Hosted by" in t:
                best = t
                break
            best = t if len(t) > len(best) else best
        if len(best) > len(cards.get(href, "")):
            cards[href] = best
    return cards


def find_chrome():
    for c in (os.environ.get("CHROME"), "google-chrome", "chromium", "chromium-browser",
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"):
        if c and (shutil.which(c) or os.path.exists(c)):
            return c
    raise SystemExit("No se encontró Chrome (usa la variable CHROME).")


def dump_dom(url, chrome):
    r = subprocess.run(
        [chrome, "--headless=new", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=15000", "--dump-dom", url],
        capture_output=True, text=True, timeout=120,
    )
    return r.stdout


def json_ld(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8", "replace")
    for block in re.findall(r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>", html, re.S):
        try:
            d = json.loads(block)
        except ValueError:
            continue
        if isinstance(d, dict) and d.get("sport"):
            return d
    return {}


def main(argv):
    if argv[:1] == ["--html"]:
        cards = {}
        for path in argv[1:]:
            with open(path, encoding="utf-8") as f:
                cards.update(cards_from_html(f.read()))
        enrich = False
    else:
        chrome = find_chrome()
        cards = {}
        for url in LIST_PAGES:
            try:
                cards.update(cards_from_html(dump_dom(url, chrome)))
            except Exception as e:  # una página caída no detiene las demás
                print(f"[cm] {url}: {e}", file=sys.stderr)
        enrich = True

    out = []
    for href, card in cards.items():
        item = {"url": BASE + href, "organizador": href.split("/")[2], "tarjeta": card}
        if enrich:
            try:
                d = json_ld(item["url"])
                item.update({k: d.get(k) for k in ("name", "sport", "startDate", "doorTime", "isAccessibleForFree",
                                                    "maximumAttendeeCapacity", "remainingAttendeeCapacity", "description")})
            except Exception as e:
                item["error"] = str(e)
        out.append(item)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    print()
    print(f"[cm] {len(out)} torneos en {len(LIST_PAGES) if enrich else 'archivos'} páginas", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1:])
