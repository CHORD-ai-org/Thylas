# -*- coding: utf-8 -*-
import io, re, sys

FIG1 = '''<figure>
    <svg viewBox="0 0 760 470" role="img" aria-labelledby="fig1t fig1d" xmlns="http://www.w3.org/2000/svg">
      <title id="fig1t">Conceptual map of the five theoretical clusters and their relations</title>
      <desc id="fig1d">A layered diagram: context at the top, three explanatory clusters beneath it, two control boxes below those, the participation act, and two outcomes with a feedback loop.</desc>
      <defs>
        <marker id="ar" markerWidth="7" markerHeight="6" refX="6.5" refY="3" orient="auto">
          <path d="M0,0 L7,3 L0,6 z" fill="#141414"/>
        </marker>
      </defs>
      <style>
        .bx{fill:#fff;stroke:#141414;stroke-width:1}
        .bx2{fill:#f6f6f2;stroke:#8f8f8f;stroke-width:1}
        .t{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;font-size:11px;fill:#141414}
        .ts{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;font-size:10px;fill:#6b6b6b}
        .th{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;font-size:9.5px;letter-spacing:.12em;fill:#8f8f8f}
        .ln{stroke:#141414;stroke-width:1;fill:none}
        .lnd{stroke:#a8a8a8;stroke-width:1;fill:none;stroke-dasharray:3 4}
      </style>

      <text class="th" x="24" y="20">CONTEXT LAYER</text>
      <rect class="bx" x="24" y="30" width="712" height="46"/>
      <text class="t" x="40" y="49">Workspace state</text>
      <text class="ts" x="40" y="64">objects · current move · history</text>
      <text class="t" x="212" y="49">Interaction history</text>
      <text class="ts" x="212" y="64">tried · rejected · agreed</text>
      <text class="t" x="404" y="49">Learner state</text>
      <text class="ts" x="404" y="64">prior knowledge · load · regulation</text>
      <text class="t" x="646" y="49">Time</text>
      <text class="ts" x="646" y="64">session · span</text>

      <text class="th" x="24" y="106">EXPLANATORY CLUSTERS</text>
      <rect class="bx" x="24" y="116" width="210" height="150"/>
      <text class="t" x="38" y="137" style="font-weight:600">Learner cognition</text>
      <text class="ts" x="38" y="159">Working-memory limits</text>
      <text class="ts" x="38" y="176">Schema construction</text>
      <text class="ts" x="38" y="193">Active / constructive / interactive</text>
      <text class="ts" x="38" y="210">Epistemic action &amp; offloading</text>
      <text class="ts" x="38" y="227">Retention vs. performance</text>

      <rect class="bx" x="275" y="116" width="210" height="150"/>
      <text class="t" x="289" y="137" style="font-weight:600">Assistance</text>
      <text class="ts" x="289" y="159">Contingency &amp; fading</text>
      <text class="ts" x="289" y="176">Assistance dilemma</text>
      <text class="ts" x="289" y="193">Expertise reversal</text>
      <text class="ts" x="289" y="210">Productive failure</text>
      <text class="ts" x="289" y="227">Help-seeking behaviour</text>

      <rect class="bx" x="526" y="116" width="210" height="150"/>
      <text class="t" x="540" y="137" style="font-weight:600">Coordination</text>
      <text class="ts" x="540" y="159">Grounding &amp; least effort</text>
      <text class="ts" x="540" y="176">Joint problem space</text>
      <text class="ts" x="540" y="193">Co- and shared regulation</text>
      <text class="ts" x="540" y="210">Repair preference</text>
      <text class="ts" x="540" y="227">Articulation work</text>

      <path class="ln" d="M129 266 V288"/>
      <path class="ln" d="M380 266 V288"/>
      <path class="ln" d="M631 266 V288"/>
      <path class="ln" d="M129 288 H631"/>

      <rect class="bx2" x="150" y="302" width="210" height="84"/>
      <text class="t" x="164" y="323" style="font-weight:600">Initiative &amp; control</text>
      <text class="ts" x="164" y="343">Expected value of acting</text>
      <text class="ts" x="164" y="359">Levels of automation</text>
      <text class="ts" x="164" y="375">Directability · observability</text>

      <rect class="bx2" x="400" y="302" width="210" height="84"/>
      <text class="t" x="414" y="323" style="font-weight:600">Interruption cost</text>
      <text class="ts" x="414" y="343">Moment within task</text>
      <text class="ts" x="414" y="359">Resumption lag · residue</text>
      <text class="ts" x="414" y="375">Transience of speech</text>

      <path class="ln" d="M255 288 V302" marker-end="url(#ar)"/>
      <path class="ln" d="M505 288 V302" marker-end="url(#ar)"/>

      <path class="ln" d="M255 386 V406"/>
      <path class="ln" d="M505 386 V406"/>
      <path class="ln" d="M255 406 H505"/>
      <path class="ln" d="M380 406 V428" marker-end="url(#ar)"/>

      <text class="th" x="24" y="424">PARTICIPATION ACT</text>
      <rect class="bx" x="24" y="432" width="712" height="44"/>
      <text class="t" x="40" y="452">Ask · Offer · Stay silent — each with an epistemic function, an intensity, a channel, and a persistence</text>
      <text class="ts" x="40" y="467">any of these can be right; the question is which, when, and at what cost</text>

      <path class="ln" d="M380 476 V496" marker-end="url(#ar)"/>
      <text class="ts" x="188" y="512" style="fill:#141414">immediate performance</text>
      <text class="ts" x="442" y="512" style="fill:#141414">durable learning: retention, transfer, independence</text>
      <text class="ts" x="188" y="526" style="fill:#9a9a9a">measurable now</text>
      <text class="ts" x="442" y="526" style="fill:#9a9a9a">what the product exists for</text>

      <path class="lnd" d="M700 512 H748 V53 H740" marker-end="url(#ar)"/>
      <text class="ts" x="560" y="540" style="fill:#8f8f8f">these two can diverge; the dashed path is the continuity claim</text>
    </svg>
    <figcaption><b>Figure 1.</b> The five clusters are not interchangeable explanations. The left column constrains what assistance is worth; the right column constrains what coordination is possible; the two lower boxes are the costs and the controls that decide whether an act happens at all. The dashed loop marks the point Lemma's continuity claim depends on: outcomes feed back into context, and that feedback is itself a design decision, not a storage feature.</figcaption>
  </figure>'''

FIG2 = '''<figure>
    <svg viewBox="0 0 760 436" role="img" aria-labelledby="fig2t fig2d" xmlns="http://www.w3.org/2000/svg">
      <title id="fig2t">Intensity ladder and the two error types</title>
      <desc id="fig2d">A six-rung ladder of intervention intensity, with interruption cost rising toward the top and preserved learner work falling, alongside the two error types of intervention and silence.</desc>
      <defs>
        <marker id="ar2" markerWidth="7" markerHeight="6" refX="6.5" refY="3" orient="auto">
          <path d="M0,0 L7,3 L0,6 z" fill="#141414"/>
        </marker>
        <marker id="ar3" markerWidth="7" markerHeight="6" refX="6.5" refY="3" orient="auto">
          <path d="M0,0 L7,3 L0,6 z" fill="#9a9a9a"/>
        </marker>
      </defs>
      <style>
        .t2{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;font-size:11px;fill:#141414}
        .s2{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;font-size:10px;fill:#6b6b6b}
        .h2s{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;font-size:9.5px;letter-spacing:.12em;fill:#8f8f8f}
        .rung{stroke:#141414;stroke-width:1}
        .ax{stroke:#141414;stroke-width:1;fill:none}
      </style>

      <text class="h2s" x="24" y="22">INTERVENTION INTENSITY</text>

      <rect class="rung" x="100" y="323" width="290" height="26" fill="#ffffff"/>
      <rect class="rung" x="100" y="292" width="290" height="26" fill="#fafaf7"/>
      <rect class="rung" x="100" y="261" width="290" height="26" fill="#f5f5f0"/>
      <rect class="rung" x="100" y="230" width="290" height="26" fill="#efefe8"/>
      <rect class="rung" x="100" y="199" width="290" height="26" fill="#e8e8df"/>
      <rect class="rung" x="100" y="168" width="290" height="26" fill="#e0e0d6"/>

      <text class="t2" x="112" y="340">observable silence</text>
      <text class="t2" x="112" y="309">ambient mark in the workspace</text>
      <text class="t2" x="112" y="278">one-line offer, no reply needed</text>
      <text class="t2" x="112" y="247">question that requires an answer</text>
      <text class="t2" x="112" y="216">explanation</text>
      <text class="t2" x="112" y="185">direct action on the workspace</text>

      <text class="s2" x="100" y="158">learner work preserved</text>
      <text class="s2" x="100" y="364">learner work removed</text>

      <path class="ax" d="M74 356 V162" marker-end="url(#ar2)"/>
      <text class="h2s" x="34" y="258" transform="rotate(-90 34 258)">INTERRUPTION COST</text>

      <path class="ax" d="M404 349 V162" marker-end="url(#ar3)" stroke="#9a9a9a"/>

      <text class="h2s" x="424" y="196">DESIGN PRESSURE POINT</text>
      <text class="s2" x="424" y="216">Products drift upward. A costly</text>
      <text class="s2" x="424" y="230">intervention is visible and gets</text>
      <text class="s2" x="424" y="244">reported; a missed one produces</text>
      <text class="s2" x="424" y="258">no event at all, so no one counts it.</text>

      <line x1="24" y1="376" x2="736" y2="376" stroke="#e3e3de"/>

      <text class="h2s" x="24" y="394">TWO ERROR TYPES</text>
      <text class="s2" x="24" y="412">false intervention — immediate, legible, attributed to the system</text>
      <text class="s2" x="24" y="428">false silence — delayed, invisible, attributed to the learner</text>
    </svg>
    <figcaption><b>Figure 2.</b> Intensity is a ladder with two costs rising in opposite directions, not a switch. The asymmetry at the bottom of the figure is the reason products drift toward the top rungs: an unnecessary intervention produces a visible complaint, whereas a missed one produces nothing observable at all. Any serious participation policy has to charge itself for the second error, which means instrumenting for it deliberately.</figcaption>
  </figure>'''

for path, fig in [("parts/p1.html", FIG1), ("parts/p5.html", FIG2)]:
    s = io.open(path, encoding="utf-8").read()
    n = len(re.findall(r"<figure>.*?</figure>", s, re.S))
    s2 = re.sub(r"<figure>.*?</figure>", lambda m: fig, s, count=1, flags=re.S)
    io.open(path, "w", encoding="utf-8").write(s2)
    print(path, "figures found:", n)
