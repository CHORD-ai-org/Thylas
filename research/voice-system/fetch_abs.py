import json, time, urllib.request, urllib.parse, sys, os

DOIS = [
"10.1111/j.1469-7610.1976.tb00381.x","10.1007/s10648-007-9049-0","10.1080/07370000802212669",
"10.1207/s15326985ep3801_4","10.1177/1745691615569000","10.3102/00346543073003277",
"10.1080/00461520.2011.611369","10.1038/s41598-025-97652-6","10.2139/ssrn.4895486",
"10.1111/j.1756-8765.2008.01005.x","10.1080/00461520.2012.748006","10.1016/j.learninstruc.2008.03.001",
"10.1037/10096-006","10.1111/ejed.12527","10.1007/978-3-642-85098-1_5","10.1145/302979.303030",
"10.1109/3468.844354","10.1109/mis.2004.74","10.1145/3290605.3300233","10.1518/001872095779064555",
"10.1145/985692.985727","10.1145/1240624.1240730","10.1037/a0014402","10.1016/j.obhdp.2009.04.002",
"10.1016/j.learninstruc.2005.07.001","10.1002/acp.1787","10.1145/319382.319398","10.1145/2858036.2858288",
"10.1145/3173574.3174214","10.1016/0010-0277(86)90010-7","10.1207/s15516709cog1801_3",
"10.1207/s15516709cog1804_1","10.1207/s15327051hci1812_6","10.2307/413107","10.1207/s15327051hci1523_4",
"10.1037/0021-9010.88.4.587","10.1145/142621.142641","10.3102/003465430298487","10.1016/j.tics.2016.07.002",
"10.1145/3706598.3713778","10.1016/j.learninstruc.2010.07.004","10.1207/s15326985ep4102_1",
]

def inv2text(inv):
    if not inv: return ""
    pos = []
    for w, idxs in inv.items():
        for i in idxs: pos.append((i, w))
    pos.sort()
    return " ".join(w for _, w in pos)

res = {}
for doi in DOIS:
    url = "https://api.openalex.org/works/doi:" + urllib.parse.quote(doi)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "lemma-litreview/1.0 (mailto:zhaoceaser@gmail.com)"})
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode("utf-8"))
        res[doi] = {
            "title": d.get("title"),
            "year": d.get("publication_year"),
            "venue": ((d.get("primary_location") or {}).get("source") or {}).get("display_name"),
            "cited_by": d.get("cited_by_count"),
            "abstract": inv2text(d.get("abstract_inverted_index")),
            "oa": (d.get("open_access") or {}).get("oa_url"),
        }
    except Exception as e:
        res[doi] = {"err": str(e)[:80]}
    time.sleep(0.15)

p = os.path.join(os.path.dirname(__file__), "abstracts.json")
with open(p, "w", encoding="utf-8") as f:
    json.dump(res, f, ensure_ascii=False, indent=1)

sys.stdout.reconfigure(encoding="utf-8")
for doi, v in res.items():
    if "err" in v:
        print("ERR", doi, v["err"]); continue
    print("\n[" + doi + "] " + str(v["title"])[:80] + " | " + str(v["year"]) + " | cites=" + str(v["cited_by"]))
    print((v["abstract"] or "(no abstract)")[:900])
