import json, time, urllib.request, urllib.parse, sys, os

# key -> doi
ITEMS = {
"wood1976": "10.1111/j.1469-7610.1976.tb00381.x",
"pea2004": "10.1207/s15327809jls1303_6",
"kirsch2006": "10.1207/s15326985ep4102_1",
"koed2007": "10.1007/s10648-007-9049-0",
"kalyuga2003": "10.1207/s15326985ep3801_4",
"kapur2008": "10.1080/07370000802212669",
"soder2015": "10.1177/1745691615569000",
"aleven2003": "10.3102/00346543073003277",
"chi2009": "10.1111/j.1756-8765.2008.01005.x",
"vanlehn2011": "10.1080/00461520.2011.611369",
"kestin2025": "10.1038/s41598-025-97652-6",
"bastani2025": "10.1073/pnas.2422633122",
"hattie2007": "10.3102/003465430298487",
"jarvela2013": "10.1080/00461520.2012.748006",
"volet2009": "10.1016/j.learninstruc.2008.03.001",
"roschelle1995": "10.1007/978-3-642-85098-1_5",
"clarkbrennan1991": "10.1037/10096-006",
"hollan2000": "10.1145/353485.353487",
"sebanz2006": "10.1016/j.tics.2005.12.009",
"molenaar2022": "10.1016/j.caeai.2022.100070",
"mathieu2000": "10.1037/0021-9010.85.2.273",
"horvitz1999": "10.1145/302979.303030",
"allen1999": "10.1109/5254.796083",
"carbonell1970": "10.1109/tmms.1970.299942",
"terveen1995": "10.1016/0950-7051(95)98369-h",
"para2000": "10.1109/3468.844354",
"parariley1997": "10.1518/001872097778543886",
"klein2004": "10.1109/mis.2004.74",
"amershi2019": "10.1145/3290605.3300233",
"endsley1995": "10.1518/001872095779064555",
"shneimaes1997": "10.1145/267505.267514",
"adamczyk2004": "10.1145/985692.985727",
"iqbal2007": "10.1145/1240624.1240730",
"monk2008": "10.1037/a0014402",
"altmann2002": "10.1207/s15516709cog2601_2",
"leroy2009": "10.1016/j.obhdp.2009.04.002",
"bailey2006": "10.1016/j.chb.2005.12.009",
"wickens2002": "10.1080/14639220210123806",
"ginns2005": "10.1016/j.learninstruc.2005.07.001",
"leahy2011": "10.1002/acp.1787",
"singh2012": "10.1002/acp.2885",
"risko2016": "10.1016/j.tics.2016.07.002",
"lee2025": "10.1145/3706598.3713778",
"oviatt1999": "10.1145/319382.319398",
"oviatt1997": "10.1145/258549.258821",
"cohen1992": "10.1145/142621.142641",
"luger2016": "10.1145/2858036.2858288",
"porcheron2018": "10.1145/3173574.3174214",
"nass2000": "10.1111/0022-4537.00153",
"clark2019": "10.1145/3290605.3300705",
"clarkwg1986": "10.1016/0010-0277(86)90010-7",
"zhang1994": "10.1207/s15516709cog1801_3",
"kirsh1994": "10.1207/s15516709cog1804_1",
"schegloff1977": "10.2307/413107",
"whittaker2003": "10.1207/s15327051hci1812_6",
"olson2000": "10.1207/s15327051hci1523_4",
"lewis2003": "10.1037/0021-9010.88.4.587",
"rajaram2010": "10.1177/1745691610388763",
"schmidt1992": "10.1007/bf00752449",
"nardi2005": "10.1007/s10606-004-8127-9",
}

out = {}
for k, doi in ITEMS.items():
    url = "https://api.crossref.org/works/" + urllib.parse.quote(doi)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "lemma-litreview/1.0 (mailto:zhaoceaser@gmail.com)"})
        with urllib.request.urlopen(req, timeout=30) as r:
            it = json.loads(r.read().decode("utf-8"))["message"]
        auth = []
        for a in it.get("author", []):
            fam = a.get("family", "")
            given = a.get("given", "")
            ini = "".join(p[0] + "." for p in given.replace("-", " ").split() if p)
            auth.append(f"{fam}, {ini}".strip().rstrip(","))
        out[k] = {
            "title": (it.get("title") or [""])[0].replace("\n", " ").strip(),
            "authors": auth,
            "n_auth": len(it.get("author", [])),
            "year": (it.get("issued", {}).get("date-parts") or [[None]])[0][0],
            "journal": (it.get("container-title") or [""])[0],
            "volume": it.get("volume"), "issue": it.get("issue"), "page": it.get("page"),
            "doi": it.get("DOI"), "type": it.get("type"), "publisher": it.get("publisher"),
        }
    except Exception as e:
        out[k] = {"err": str(e)[:90], "doi": doi}
    time.sleep(0.2)

p = os.path.join(os.path.dirname(__file__), "bib.json")
json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
sys.stdout.reconfigure(encoding="utf-8")
for k, v in out.items():
    if "err" in v:
        print("ERR", k, v["err"]); continue
    print(k, "||", "; ".join(v["authors"]), "||", v["year"], "||", v["title"], "||", v["journal"], "||",
          v["volume"], v["issue"], v["page"], "||", v["doi"])
