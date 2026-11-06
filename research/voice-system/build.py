# -*- coding: utf-8 -*-
"""Assemble the Lemma Voice research report from HTML parts.
Citation tokens of the form [[key]] are replaced with numbered links to the
bibliography, which is generated (and numbered) from REFS below.
"""
import os, re, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "lemma-voice-theoretical-foundations.html"))

# key: (authors, year, title, venue, volinfo, doi_or_None, note)
REFS = {
"wood1976": ("Wood, D., Bruner, J. S., & Ross, G.", 1976,
  "The role of tutoring in problem solving",
  "Journal of Child Psychology and Psychiatry", "17(2), 89–100",
  "10.1111/j.1469-7610.1976.tb00381.x", ""),
"pea2004": ("Pea, R. D.", 2004,
  "The social and technological dimensions of scaffolding and related theoretical concepts for learning, education, and human activity",
  "Journal of the Learning Sciences", "13(3), 423–451",
  "10.1207/s15327809jls1303_6", ""),
"kirsch2006": ("Kirschner, P. A., Sweller, J., & Clark, R. E.", 2006,
  "Why minimal guidance during instruction does not work: An analysis of the failure of constructivist, discovery, problem-based, experiential, and inquiry-based teaching",
  "Educational Psychologist", "41(2), 75–86",
  "10.1207/s15326985ep4102_1", ""),
"koed2007": ("Koedinger, K. R., & Aleven, V.", 2007,
  "Exploring the assistance dilemma in experiments with cognitive tutors",
  "Educational Psychology Review", "19(3), 239–264",
  "10.1007/s10648-007-9049-0", ""),
"kalyuga2003": ("Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J.", 2003,
  "The expertise reversal effect",
  "Educational Psychologist", "38(1), 23–31",
  "10.1207/s15326985ep3801_4", ""),
"kapur2008": ("Kapur, M.", 2008, "Productive failure",
  "Cognition and Instruction", "26(3), 379–424",
  "10.1080/07370000802212669", ""),
"soder2015": ("Soderstrom, N. C., & Bjork, R. A.", 2015,
  "Learning versus performance: An integrative review",
  "Perspectives on Psychological Science", "10(2), 176–199",
  "10.1177/1745691615569000", ""),
"aleven2003": ("Aleven, V., Stahl, E., Schworm, S., Fischer, F., & Wallace, R.", 2003,
  "Help seeking and help design in interactive learning environments",
  "Review of Educational Research", "73(3), 277–320",
  "10.3102/00346543073003277", ""),
"chi2009": ("Chi, M. T. H.", 2009,
  "Active-constructive-interactive: A conceptual framework for differentiating learning activities",
  "Topics in Cognitive Science", "1(1), 73–105",
  "10.1111/j.1756-8765.2008.01005.x", ""),
"vanlehn2011": ("VanLehn, K.", 2011,
  "The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems",
  "Educational Psychologist", "46(4), 197–221",
  "10.1080/00461520.2011.611369", ""),
"kestin2025": ("Kestin, G., Miller, K., Klales, A., Milbourne, T., & Ponti, G.", 2025,
  "AI tutoring outperforms in-class active learning: An RCT introducing a novel research-based design in an authentic educational setting",
  "Scientific Reports", "15, Article 17458",
  "10.1038/s41598-025-97652-6", ""),
"bastani2025": ("Bastani, H., Bastani, O., Sungu, A., Ge, H., Kabakcı, Ö., & Mariman, R.", 2025,
  "Generative AI without guardrails can harm learning: Evidence from high school mathematics",
  "Proceedings of the National Academy of Sciences", "122(26)",
  "10.1073/pnas.2422633122", "Earlier version circulated as an SSRN working paper (2024)."),
"vandepol2010": ("van de Pol, J., Volman, M., & Beishuizen, J.", 2010,
  "Scaffolding in teacher-student interaction: A decade of research",
  "Educational Psychology Review", "22(3), 271–296",
  "10.1007/s10648-010-9127-6", ""),
"roll2011": ("Roll, I., Aleven, V., McLaren, B. M., & Koedinger, K. R.", 2011,
  "Improving students' help-seeking skills using metacognitive feedback in an intelligent tutoring system",
  "Learning and Instruction", "21(2), 267–280",
  "10.1016/j.learninstruc.2010.07.004", ""),
"hattie2007": ("Hattie, J., & Timperley, H.", 2007, "The power of feedback",
  "Review of Educational Research", "77(1), 81–112",
  "10.3102/003465430298487", ""),
"jarvela2013": ("Järvelä, S., & Hadwin, A. F.", 2013,
  "New frontiers: Regulating learning in CSCL",
  "Educational Psychologist", "48(1), 25–39",
  "10.1080/00461520.2012.748006", ""),
"volet2009": ("Volet, S., Summers, M., & Thurman, J.", 2009,
  "High-level co-regulation in collaborative learning: How does it emerge and how is it sustained?",
  "Learning and Instruction", "19(2), 128–143",
  "10.1016/j.learninstruc.2008.03.001", ""),
"roschelle1995": ("Roschelle, J., & Teasley, S. D.", 1995,
  "The construction of shared knowledge in collaborative problem solving",
  "In C. O'Malley (Ed.), <i>Computer Supported Collaborative Learning</i> (pp. 69–97). Springer",
  "", "10.1007/978-3-642-85098-1_5", "Book chapter."),
"clarkbrennan1991": ("Clark, H. H., & Brennan, S. E.", 1991,
  "Grounding in communication",
  "In L. B. Resnick, J. M. Levine, & S. D. Teasley (Eds.), <i>Perspectives on Socially Shared Cognition</i> (pp. 127–149). APA",
  "", "10.1037/10096-006", "Book chapter."),
"hollan2000": ("Hollan, J., Hutchins, E., & Kirsh, D.", 2000,
  "Distributed cognition: Toward a new foundation for human-computer interaction research",
  "ACM Transactions on Computer-Human Interaction", "7(2), 174–196",
  "10.1145/353485.353487", ""),
"sebanz2006": ("Sebanz, N., Bekkering, H., & Knoblich, G.", 2006,
  "Joint action: Bodies and minds moving together",
  "Trends in Cognitive Sciences", "10(2), 70–76",
  "10.1016/j.tics.2005.12.009", ""),
"molenaar2022": ("Molenaar, I.", 2022,
  "The concept of hybrid human-AI regulation: Exemplifying how to support young learners' self-regulated learning",
  "Computers and Education: Artificial Intelligence", "3, Article 100070",
  "10.1016/j.caeai.2022.100070", ""),
"mathieu2000": ("Mathieu, J. E., Heffner, T. S., Goodwin, G. F., Salas, E., & Cannon-Bowers, J. A.", 2000,
  "The influence of shared mental models on team process and performance",
  "Journal of Applied Psychology", "85(2), 273–283",
  "10.1037/0021-9010.85.2.273", ""),
"horvitz1999": ("Horvitz, E.", 1999, "Principles of mixed-initiative user interfaces",
  "Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '99), 159–166",
  "", "10.1145/302979.303030", ""),
"allen1999": ("Allen, J. F., Guinn, C. I., & Horvitz, E.", 1999,
  "Mixed-initiative interaction",
  "IEEE Intelligent Systems", "14(5), 14–23",
  "10.1109/5254.796083", ""),
"carbonell1970": ("Carbonell, J. R.", 1970,
  "AI in CAI: An artificial-intelligence approach to computer-assisted instruction",
  "IEEE Transactions on Man-Machine Systems", "11(4), 190–202",
  "10.1109/tmms.1970.299942", ""),
"terveen1995": ("Terveen, L. G.", 1995, "An overview of human-computer collaboration",
  "Knowledge-Based Systems", "8(2–3), 67–81",
  "10.1016/0950-7051(95)98369-h", ""),
"para2000": ("Parasuraman, R., Sheridan, T. B., & Wickens, C. D.", 2000,
  "A model for types and levels of human interaction with automation",
  "IEEE Transactions on Systems, Man, and Cybernetics – Part A", "30(3), 286–297",
  "10.1109/3468.844354", ""),
"parariley1997": ("Parasuraman, R., & Riley, V.", 1997,
  "Humans and automation: Use, misuse, disuse, abuse",
  "Human Factors", "39(2), 230–253",
  "10.1518/001872097778543886", ""),
"klein2004": ("Klein, G., Woods, D. D., Bradshaw, J. M., Hoffman, R. R., & Feltovich, P. J.", 2004,
  "Ten challenges for making automation a \u201cteam player\u201d in joint human-agent activity",
  "IEEE Intelligent Systems", "19(6), 91–95",
  "10.1109/mis.2004.74", ""),
"amershi2019": ("Amershi, S., Weld, D., Vorvoreanu, M., Fourney, A., Nushi, B., Collisson, P., Suh, J., Iqbal, S., Bennett, P. N., Inkpen, K., Teevan, J., Kikin-Gil, R., & Horvitz, E.", 2019,
  "Guidelines for human-AI interaction",
  "Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems, 1–13",
  "", "10.1145/3290605.3300233", ""),
"endsley1995": ("Endsley, M. R., & Kiris, E. O.", 1995,
  "The out-of-the-loop performance problem and level of control in automation",
  "Human Factors", "37(2), 381–394",
  "10.1518/001872095779064555", ""),
"shneimaes1997": ("Shneiderman, B., & Maes, P.", 1997,
  "Direct manipulation vs. interface agents",
  "Interactions", "4(6), 42–61",
  "10.1145/267505.267514", ""),
"adamczyk2004": ("Adamczyk, P. D., & Bailey, B. P.", 2004,
  "If not now, when? The effects of interruption at different moments within task execution",
  "Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '04), 271–278",
  "", "10.1145/985692.985727", ""),
"iqbal2007": ("Iqbal, S. T., & Horvitz, E.", 2007,
  "Disruption and recovery of computing tasks: Field study, analysis, and directions",
  "Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '07), 677–686",
  "", "10.1145/1240624.1240730", ""),
"monk2008": ("Monk, C. A., Trafton, J. G., & Boehm-Davis, D. A.", 2008,
  "The effect of interruption duration and demand on resuming suspended goals",
  "Journal of Experimental Psychology: Applied", "14(4), 299–313",
  "10.1037/a0014402", ""),
"altmann2002": ("Altmann, E. M., & Trafton, J. G.", 2002,
  "Memory for goals: An activation-based model",
  "Cognitive Science", "26(1), 39–83",
  "10.1207/s15516709cog2601_2", ""),
"leroy2009": ("Leroy, S.", 2009,
  "Why is it so hard to do my work? The challenge of attention residue when switching between work tasks",
  "Organizational Behavior and Human Decision Processes", "109(2), 168–181",
  "10.1016/j.obhdp.2009.04.002", ""),
"bailey2006": ("Bailey, B. P., & Konstan, J. A.", 2006,
  "On the need for attention-aware systems: Measuring effects of interruption on task performance, error rate, and affective state",
  "Computers in Human Behavior", "22(4), 685–708",
  "10.1016/j.chb.2005.12.009", ""),
"wickens2002": ("Wickens, C. D.", 2002, "Multiple resources and performance prediction",
  "Theoretical Issues in Ergonomics Science", "3(2), 159–177",
  "10.1080/14639220210123806", ""),
"ginns2005": ("Ginns, P.", 2005, "Meta-analysis of the modality effect",
  "Learning and Instruction", "15(4), 313–331",
  "10.1016/j.learninstruc.2005.07.001", ""),
"leahy2011": ("Leahy, W., & Sweller, J.", 2011,
  "Cognitive load theory, modality of presentation and the transient information effect",
  "Applied Cognitive Psychology", "25(6), 943–951",
  "10.1002/acp.1787", ""),
"singh2012": ("Singh, A., Marcus, N., & Ayres, P.", 2012,
  "The transient information effect: Investigating the impact of segmentation on spoken and written text",
  "Applied Cognitive Psychology", "26(6), 848–853",
  "10.1002/acp.2885", ""),
"risko2016": ("Risko, E. F., & Gilbert, S. J.", 2016, "Cognitive offloading",
  "Trends in Cognitive Sciences", "20(9), 676–688",
  "10.1016/j.tics.2016.07.002", ""),
"lee2025": ("Lee, H.-P., Sarkar, A., Tankelevitch, L., Drosos, I., Rintel, S., Banks, R., & Wilson, N.", 2025,
  "The impact of generative AI on critical thinking: Self-reported reductions in cognitive effort and confidence effects from a survey of knowledge workers",
  "Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems, 1–22",
  "", "10.1145/3706598.3713778", ""),
"oviatt1999": ("Oviatt, S.", 1999, "Ten myths of multimodal interaction",
  "Communications of the ACM", "42(11), 74–81",
  "10.1145/319382.319398", ""),
"oviatt1997": ("Oviatt, S., DeAngeli, A., & Kuhn, K.", 1997,
  "Integration and synchronization of input modes during multimodal human-computer interaction",
  "Proceedings of the ACM SIGCHI Conference on Human Factors in Computing Systems (CHI '97), 415–422",
  "", "10.1145/258549.258821", ""),
"cohen1992": ("Cohen, P. R.", 1992,
  "The role of natural language in a multimodal interface",
  "Proceedings of the 5th Annual ACM Symposium on User Interface Software and Technology (UIST '92), 143–149",
  "", "10.1145/142621.142641", ""),
"luger2016": ("Luger, E., & Sellen, A.", 2016,
  "\u201cLike having a really bad PA\u201d: The gulf between user expectation and experience of conversational agents",
  "Proceedings of the 2016 CHI Conference on Human Factors in Computing Systems, 5286–5297",
  "", "10.1145/2858036.2858288", ""),
"porcheron2018": ("Porcheron, M., Fischer, J. E., Reeves, S., & Sharples, S.", 2018,
  "Voice interfaces in everyday life",
  "Proceedings of the 2018 CHI Conference on Human Factors in Computing Systems, 1–12",
  "", "10.1145/3173574.3174214", ""),
"nass2000": ("Nass, C., & Moon, Y.", 2000,
  "Machines and mindlessness: Social responses to computers",
  "Journal of Social Issues", "56(1), 81–103",
  "10.1111/0022-4537.00153", ""),
"clark2019": ("Clark, L., Pantidi, N., Cooney, O., Doyle, P., Garaialde, D., Edwards, J., Spillane, B., Gilmartin, E., Murad, C., Munteanu, C., Wade, V., & Cowan, B. R.", 2019,
  "What makes a good conversation? Challenges in designing truly conversational agents",
  "Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems, 1–12",
  "", "10.1145/3290605.3300705", ""),
"clarkwg1986": ("Clark, H. H., & Wilkes-Gibbs, D.", 1986,
  "Referring as a collaborative process",
  "Cognition", "22(1), 1–39",
  "10.1016/0010-0277(86)90010-7", ""),
"zhang1994": ("Zhang, J., & Norman, D. A.", 1994,
  "Representations in distributed cognitive tasks",
  "Cognitive Science", "18(1), 87–122",
  "10.1207/s15516709cog1801_3", ""),
"kirsh1994": ("Kirsh, D., & Maglio, P.", 1994,
  "On distinguishing epistemic from pragmatic action",
  "Cognitive Science", "18(4), 513–549",
  "10.1207/s15516709cog1804_1", ""),
"schegloff1977": ("Schegloff, E. A., Jefferson, G., & Sacks, H.", 1977,
  "The preference for self-correction in the organization of repair in conversation",
  "Language", "53(2), 361–382",
  "10.2307/413107", ""),
"whittaker2003": ("Whittaker, S.", 2003, "Things to talk about when talking about things",
  "Human-Computer Interaction", "18(1–2), 149–170",
  "10.1207/s15327051hci1812_6", ""),
"olson2000": ("Olson, G. M., & Olson, J. S.", 2000, "Distance matters",
  "Human-Computer Interaction", "15(2–3), 139–178",
  "10.1207/s15327051hci1523_4", ""),
"lewis2003": ("Lewis, K.", 2003,
  "Measuring transactive memory systems in the field: Scale development and validation",
  "Journal of Applied Psychology", "88(4), 587–604",
  "10.1037/0021-9010.88.4.587", ""),
"rajaram2010": ("Rajaram, S., & Pereira-Pasarin, L. P.", 2010,
  "Collaborative memory: Cognitive research and theory",
  "Perspectives on Psychological Science", "5(6), 649–663",
  "10.1177/1745691610388763", ""),
"schmidt1992": ("Schmidt, K., & Bannon, L.", 1992, "Taking CSCW seriously: Supporting articulation work",
  "Computer Supported Cooperative Work (CSCW)", "1(1–2), 7–40",
  "10.1007/bf00752449", ""),
"nardi2005": ("Nardi, B. A.", 2005,
  "Beyond bandwidth: Dimensions of connection in interpersonal communication",
  "Computer Supported Cooperative Work (CSCW)", "14(2), 91–130",
  "10.1007/s10606-004-8127-9", ""),
"suchman1987": ("Suchman, L. A.", 1987,
  "<i>Plans and situated actions: The problem of human-machine communication</i>. Cambridge University Press",
  "", "", "Book."),
}

SORT_KEYS = {
"wood1976":"Wood","pea2004":"Pea","kirsch2006":"Kirschner","koed2007":"Koedinger","kalyuga2003":"Kalyuga",
"kapur2008":"Kapur","soder2015":"Soderstrom","aleven2003":"Aleven","chi2009":"Chi","vanlehn2011":"VanLehn",
"kestin2025":"Kestin","bastani2025":"Bastani","hattie2007":"Hattie","jarvela2013":"Jarvela","volet2009":"Volet",
"vandepol2010":"van de Pol","roll2011":"Roll",
"roschelle1995":"Roschelle","clarkbrennan1991":"Clark","hollan2000":"Hollan","sebanz2006":"Sebanz",
"molenaar2022":"Molenaar","mathieu2000":"Mathieu","horvitz1999":"Horvitz","allen1999":"Allen",
"carbonell1970":"Carbonell","terveen1995":"Terveen","para2000":"Parasuraman","parariley1997":"Parasuraman",
"klein2004":"Klein","amershi2019":"Amershi","endsley1995":"Endsley","shneimaes1997":"Shneiderman",
"adamczyk2004":"Adamczyk","iqbal2007":"Iqbal","monk2008":"Monk","altmann2002":"Altmann","leroy2009":"Leroy",
"bailey2006":"Bailey","wickens2002":"Wickens","ginns2005":"Ginns","leahy2011":"Leahy","singh2012":"Singh",
"risko2016":"Risko","lee2025":"Lee","oviatt1999":"Oviatt","oviatt1997":"Oviatt","cohen1992":"Cohen",
"luger2016":"Luger","porcheron2018":"Porcheron","nass2000":"Nass","clark2019":"Clark","clarkwg1986":"Clark",
"zhang1994":"Zhang","kirsh1994":"Kirsh","schegloff1977":"Schegloff","whittaker2003":"Whittaker",
"olson2000":"Olson","lewis2003":"Lewis","rajaram2010":"Rajaram","schmidt1992":"Schmidt","nardi2005":"Nardi",
"suchman1987":"Suchman",
}

for _k,_v in list(REFS.items()):
    if len(_v)==6: REFS[_k]=tuple(_v)+("",)

ALIAS = {"kirschner2006":"kirsch2006","kirsch2006":"kirsch2006"}
for a,b in ALIAS.items():
    if a!=b and a in REFS: pass

order = sorted(REFS.keys(), key=lambda k: (SORT_KEYS[k].lower(), REFS[k][1], REFS[k][2].lower()))
NUM = {k: i + 1 for i, k in enumerate(order)}
NUM.update({a: NUM[b] for a,b in ALIAS.items() if b in NUM})

def bib_entry(k):
    au, yr, ti, ve, vol, doi, note = REFS[k]
    parts = [f'<span class="bib-au">{au}</span> ({yr}). {ti}. ']
    if ve:
        parts.append(f'<i>{ve}</i>')
        if vol:
            parts.append(f', {vol}')
        parts.append('. ')
    else:
        parts.append('. ')
    if doi:
        parts.append(f'<a class="doi" href="https://doi.org/{doi}" target="_blank" rel="noopener">doi:{doi}</a>')
    if note:
        parts.append(f' <span class="bib-note">{note}</span>')
    return "".join(parts)

def build_bibliography():
    out = ['<ol class="bib">']
    for k in order:
        out.append(f'<li id="ref-{NUM[k]}">{bib_entry(k)}</li>')
    out.append('</ol>')
    return "\n".join(out)

def sub_cites(txt):
    def rep(m):
        keys = [x.strip() for x in m.group(1).split(",")]
        links = []
        keys = sorted(keys, key=lambda k: NUM[k])
        for k in keys:
            if k not in NUM:
                raise SystemExit("unknown ref key: " + k)
            links.append(f'<a class="cite" href="#ref-{NUM[k]}">{NUM[k]}</a>')
        return '<span class="cites">[' + ", ".join(links) + ']</span>'
    return re.sub(r"\[\[([a-z0-9_,\s]+)\]\]", rep, txt)

parts = []
for name in ["p1.html", "p2.html", "p3.html", "p4.html", "p5.html"]:
    p = os.path.join(HERE, "parts", name)
    with open(p, encoding="utf-8") as f:
        parts.append(sub_cites(f.read()))

doc = "\n".join(parts)
doc = doc.replace("<!--BIBLIOGRAPHY-->", build_bibliography())

with open(OUT, "w", encoding="utf-8") as f:
    f.write(doc)

used = set(re.findall(r"\[\[([a-z0-9_,\s]+)\]\]", "".join(open(os.path.join(HERE,'parts',n),encoding='utf-8').read() for n in ["p1.html","p2.html","p3.html","p4.html","p5.html"])))
used_keys = set()
for u in used:
    for x in u.split(","):
        used_keys.add(x.strip())
print("refs:", len(REFS), "cited-in-text:", len(used_keys), "uncited:", sorted(set(REFS)-used_keys))
print("bytes:", os.path.getsize(OUT))
