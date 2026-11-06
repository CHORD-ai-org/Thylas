import json, time, urllib.parse, urllib.request, sys, os

QUERIES = [
 # Learning / scaffolding
 "The role of tutoring in problem solving Wood Bruner Ross 1976",
 "The assistance dilemma in experiments with cognitive tutors Koedinger Aleven",
 "Cognitive load during problem solving effects on learning Sweller 1988",
 "Cognitive architecture and instructional design 20 years later Sweller van Merrienboer Paas",
 "Why minimal guidance during instruction does not work Kirschner Sweller Clark",
 "Scaffolding and achievement in problem-based and inquiry learning a response to Kirschner Hmelo-Silver",
 "Scaffolding in teacher-student interaction a decade of research van de Pol Volman Beishuizen",
 "The social and technological dimensions of scaffolding and related theoretical concepts Pea 2004",
 "Productive failure Kapur 2008 Cognition and Instruction",
 "A further study of productive failure in mathematical problem solving unpacking the design components Kapur",
 "The expertise reversal effect Kalyuga Ayres Chandler Sweller",
 "Learning versus performance an integrative review Soderstrom Bjork",
 "Desirable difficulties in theory and practice Bjork Bjork 2020",
 "Becoming a self-regulated learner an overview Zimmerman 2002",
 "Metacognition and cognitive monitoring a new area of cognitive-developmental inquiry Flavell 1979",
 "Self-regulated learning beliefs techniques and illusions Bjork Dunlosky Kornell",
 "Help seeking and help design in interactive learning environments Aleven Stahl Schworm Fischer Wallace",
 "Improving students help-seeking skills using metacognitive feedback in an intelligent tutoring system Roll Aleven McLaren Koedinger",
 "The relative effectiveness of human tutoring intelligent tutoring systems and other tutoring systems VanLehn",
 "Intelligent tutoring systems and learning outcomes a meta-analysis Ma Adesope Nesbit Liu",
 "Effectiveness of intelligent tutoring systems a meta-analytic review Kulik Fletcher",
 "Cognitive apprenticeship teaching the craft of reading writing and mathematics Collins Brown Newman",
 "The power of feedback Hattie Timperley 2007",
 "Learning from human tutoring Chi Siler Jeong Yamauchi Hausmann",
 "Collaborative dialogue patterns in naturalistic one-to-one tutoring Graesser Person Magliano",
 "Help seeking learning and contingent tutoring Wood Wood 1999",
 "Dynamics of affective states during complex learning D'Mello Graesser",
 # Co-regulation / collaboration
 "New frontiers regulating learning in CSCL Jarvela Hadwin 2013",
 "High-level co-regulation in collaborative learning how does it emerge and how is it sustained Volet Summers Thurman",
 "The construction of shared knowledge in collaborative problem solving Roschelle Teasley",
 "Grounding in communication Clark Brennan 1991",
 "Referring as a collaborative process Clark Wilkes-Gibbs 1986",
 "Distributed cognition toward a new foundation for human-computer interaction research Hollan Hutchins Kirsh",
 "The influence of shared mental models on team process and performance Mathieu Heffner Goodwin Salas Cannon-Bowers",
 "Joint action bodies and minds moving together Sebanz Bekkering Knoblich",
 "Understanding and sharing intentions the origins of cultural cognition Tomasello Carpenter Call Behne Moll",
 "Measuring transactive memory systems in the field scale development and validation Lewis 2003",
 "Collaborative memory cognitive research and theory Rajaram Pereira-Pasarin",
 "The preference for self-correction in the organization of repair in conversation Schegloff Jefferson Sacks",
 "A simplest systematics for the organization of turn-taking in conversation Sacks Schegloff Jefferson",
 # Mixed initiative
 "Mixed-initiative interaction Allen Guinn Horvitz 1999",
 "AI in CAI an artificial-intelligence approach to computer-assisted instruction Carbonell 1970",
 "An overview of human-computer collaboration Terveen 1995",
 "A model for types and levels of automation Parasuraman Sheridan Wickens 2000",
 "Humans and automation use misuse disuse abuse Parasuraman Riley 1997",
 "Ironies of automation Bainbridge 1983",
 "Direct manipulation vs interface agents Shneiderman Maes 1997",
 "Guidelines for human-AI interaction Amershi Weld Vorvoreanu 2019",
 "Ten challenges for making automation a team player in joint human-agent activity Klein Woods Bradshaw Hoffman Feltovich",
 "The out-of-the-loop performance problem and level of control in automation Endsley Kiris",
 "From here to autonomy lessons learned from human-automation research Endsley 2017",
 "Models of attention in computing and communication from principles to applications Horvitz Kadie Paek Hovel",
 "Predicting human interruptibility with sensors Fogarty Hudson Atkeson Avrahami Forlizzi Kiesler Lee Yang",
 "Does automation bias decision-making Skitka Mosier Burdick",
 # Interruption / attention
 "If not now when the effects of interruption at different moments within task execution Adamczyk Bailey",
 "The cost of interrupted work more speed and stress Mark Gudith Klocke",
 "Disruption and recovery of computing tasks field study analysis and directions Iqbal Horvitz",
 "The effect of interruption duration and demand on resuming suspended goals Monk Trafton Boehm-Davis",
 "Memory for goals an activation-based model Altmann Trafton",
 "Why is it so hard to do my work the challenge of attention residue when switching between work tasks Leroy",
 "Threaded cognition an integrated theory of concurrent multitasking Salvucci Taatgen",
 "Dual-task interference in simple tasks data and theory Pashler 1994",
 "Multiple resources and performance prediction Wickens 2002",
 "The magical number 4 in short-term memory a reconsideration of mental storage capacity Cowan 2001",
 "Working memory looking back and looking forward Baddeley 2003",
 "Nine ways to reduce cognitive load in multimedia learning Mayer Moreno 2003",
 "Meta-analysis of the modality effect Ginns 2005",
 "The perceptual basis of the modality effect in multimedia learning Rummer Schweppe Fuerstenberg Scheiter Zindler",
 "The transient information effect investigating the impact of segmentation on spoken and written text Singh Marcus Ayres",
 "Cognitive load theory modality of presentation and the transient information effect Leahy Sweller",
 "Cognitive offloading Risko Gilbert 2016",
 "Google effects on memory cognitive consequences of having information at our fingertips Sparrow Liu Wegner",
 # Voice / multimodal
 "Ten myths of multimodal interaction Oviatt 1999",
 "Integration and synchronization of input modes during multimodal human-computer interaction Oviatt DeAngeli Kuhn",
 "Put-that-there voice and gesture at the graphics interface Bolt 1980",
 "The role of natural language in a multimodal interface Cohen 1992",
 "Direct manipulation a step beyond programming languages Shneiderman 1983",
 "Direct manipulation interfaces Hutchins Hollan Norman 1985",
 "Machines and mindlessness social responses to computers Nass Moon 2000",
 "Toward a more robust theory and measure of social presence Biocca Harms Burgoon",
 "Like having a really bad PA the gulf between user expectation and experience of conversational agents Luger Sellen",
 "Voice interfaces in everyday life Porcheron Fischer Reeves Sharples",
 "Music search and IoT how people really use voice assistants Ammari Kaye Tsai Bentley",
 "Beyond bandwidth dimensions of connection in interpersonal communication Nardi 2005",
 # Workspace / continuity / CSCW
 "Taking CSCW seriously supporting articulation work Schmidt Bannon",
 "The intellectual challenge of CSCW the gap between social requirements and technical feasibility Ackerman",
 "Distance matters Olson Olson 2000",
 "Things to talk about when talking about things Whittaker 2003",
 "Representations in distributed cognitive tasks Zhang Norman 1994",
 "On distinguishing epistemic from pragmatic action Kirsh Maglio 1994",
 "Plans and situated actions the problem of human machine communication Suchman 1987",
 "Activity theory and distributed cognition or what does CSCW need to do with theories Halverson",
 "Computer-supported cooperative work history and focus Grudin 1994",
 "User experience over time an initial framework Karapanos Zimmerman Forlizzi Martens",
 # AI and learning recent
 "Generative AI can harm learning Bastani Bastani Sungu Ge Kabakci Mariman",
 "The impact of generative AI on critical thinking self-reported reductions in cognitive effort Lee Sarkar Tankelevitch Drosos Rintel Banks Wilson",
]

def q(s):
    url = ("https://api.crossref.org/works?rows=1&select=title,author,issued,container-title,DOI,type,volume,issue,page,publisher"
           "&query.bibliographic=" + urllib.parse.quote(s))
    req = urllib.request.Request(url, headers={"User-Agent": "lemma-litreview/1.0 (mailto:zhaoceaser@gmail.com)"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))

out = []
for i, s in enumerate(QUERIES):
    try:
        d = q(s)
        items = d["message"]["items"]
        if not items:
            out.append({"query": s, "ok": False, "err": "no items"}); continue
        it = items[0]
        out.append({
            "query": s,
            "ok": True,
            "title": (it.get("title") or [""])[0],
            "authors": [ (a.get("family","")+", "+a.get("given","")) for a in it.get("author", []) ][:8],
            "year": (it.get("issued", {}).get("date-parts") or [[None]])[0][0],
            "venue": (it.get("container-title") or [""])[0],
            "doi": it.get("DOI"),
            "type": it.get("type"),
            "volume": it.get("volume"), "issue": it.get("issue"), "page": it.get("page"),
        })
    except Exception as e:
        out.append({"query": s, "ok": False, "err": str(e)[:120]})
    time.sleep(0.35)
    if i % 10 == 0:
        print(i, flush=True)

with open(os.path.join(os.path.dirname(__file__), "refs.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

fail = [o for o in out if not o["ok"]]
print("done", len(out), "fail", len(fail))
