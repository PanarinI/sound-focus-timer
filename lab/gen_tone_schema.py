#!/usr/bin/env python3
"""Схема генерации тонового слоя. Кривая во врезке считается по формулам из
`extension/tone.js` — это замер, а не рисунок от руки. Перегенерировать:

    python3 lab/gen_tone_schema.py

История правок (чтобы не наступить снова):
— 08-08 первая версия была блоками с абзацами внутри: вёрстка текста, не схема.
— вторая ушла в другую крайность — четыре графика, ось времени, проценты, разбор
  «почему пласт живёт»: точно, но переусложнено. Автор: «звучит как ты переусложнил».
— эта версия показывает ПРОЦЕСС и ничего больше: один голос → что двигает его
  громкость → общий тракт → выход. Одна врезка с настоящей кривой, потому что
  словами она не передаётся, а глазами понятна сразу.
"""
import math

OUT = "schemas/tone-layer-signal-path-2026-08-08.svg"

PHI = 1.6180339887
DENS = 0.5
W, H = 1000, 500
PX0, PX1, T, N = 300, 936, 240.0, 200      # врезка: 4 минуты

VOICE = 2                                   # рядовой голос пласта
def dc(i):  return 0.34 + DENS * 0.36 if i < 2 else -0.56 + DENS * 1.02
def lfos(i):
    base = 41 + i * 7
    return [(base, 0.62, i * 1.7), (base * PHI, 0.38, i * 1.7 + 3.1)]
def raw(i, t):
    s = dc(i)
    for per, amp, start in lfos(i):
        if t >= start: s += amp * math.sin(2 * math.pi * (t - start) / per)
    return s
def rect(x):
    if x <= 0: return 0.0
    if x >= 1: return 1.0
    return x * x * (3 - 2 * x)

xs = [PX0 + (PX1 - PX0) * k / (N - 1) for k in range(N)]
ts = [T * k / (N - 1) for k in range(N)]
pa, pb = lfos(VOICE)
P1, P2 = pa[0], pb[0]

SY, SA = 200, 15                            # синусоиды: центр и амплитуда
EY, EH = 262, 34                            # огибающая: основание и высота

def line(ys): return "M" + " L".join(f"{x:.0f} {y:.1f}" for x, y in zip(xs, ys))
sine_a = line([SY - SA * math.sin(2 * math.pi * max(t - pa[2], 0) / P1) for t in ts])
sine_b = line([SY - SA * math.sin(2 * math.pi * max(t - pb[2], 0) / P2) for t in ts])
env = ([EY - rect(raw(VOICE, t)) * EH for t in ts])
env_path = f"M{PX0} {EY} " + " ".join(f"L{x:.0f} {y:.1f}" for x, y in zip(xs, env)) + f" L{PX1} {EY} Z"

SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="max-width:100%;height:auto" role="img">
<title>How the tone is generated</title>
<desc>Signal flow of the tone layer in a focus timer. One voice is two detuned triangle oscillators through a gain; that gain is moved by two slow waves of {P1:.0f} and {P2:.0f} seconds, drawn here as measured curves, so the voice fades in and out on its own and never repeats. Eight such voices, plus a pulse, a wandering companion and occasional motifs, pass through a highpass at 150 Hz, a drifting lowpass around 1.2 kHz, a dry path and a six-second reverb, into the engine master where the brown noise already is.</desc>
<style>
:root{{--bg:#fff;--ink:#1C1917;--dim:#57534E;--faint:#A8A29E;--line:#A8A29E;--pad:#0F6E56;--padf:#E1F5EE;--mod:#5B4BC4;--modf:#EAE6FA;--warm:#B45309;--warmf:#FBEAD2}}
@media (prefers-color-scheme:dark){{:root{{--bg:#1C1917;--ink:#E7E5E4;--dim:#A8A29E;--faint:#78716C;--line:#78716C;--pad:#5DCAA5;--padf:#0C4A3A;--mod:#A99BF0;--modf:#2E2560;--warm:#FBBF6E;--warmf:#5C2D0C}}}}
text{{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;fill:var(--ink)}}
.t{{font-size:17px;font-weight:600}} .s{{font-size:12px;fill:var(--dim)}}
.n{{font-size:12.5px;font-weight:600}} .u{{font-size:11px;fill:var(--dim)}}
.cap{{font-size:10.5px;font-weight:600;letter-spacing:1.1px;fill:var(--dim)}}
.box{{fill:none;stroke:var(--line);stroke-width:1.5}}
.src{{fill:var(--padf);stroke:var(--pad);stroke-width:1.5}}
.dst{{fill:var(--warmf);stroke:var(--warm);stroke-width:1.5}}
.pan{{fill:var(--modf);fill-opacity:.4;stroke:var(--mod);stroke-width:1.4}}
.w{{fill:none;stroke:var(--line);stroke-width:1.6}}
.gl{{fill:none;stroke:var(--pad);stroke-width:1.6}}
.mod{{fill:none;stroke:var(--mod);stroke-width:1.6;stroke-dasharray:5 4}}
.sine{{fill:none;stroke:var(--mod);stroke-width:1.5;opacity:.85}}
.sine2{{fill:none;stroke:var(--mod);stroke-width:1.4;stroke-dasharray:6 4;opacity:.6}}
.env{{fill:var(--mod);fill-opacity:.35;stroke:var(--mod);stroke-width:1.4}}
.head{{fill:var(--line)}}
</style>
<rect x="0" y="0" width="{W}" height="{H}" fill="var(--bg)"/>

<text class="t" x="40" y="34">How the tone is generated</text>
<text class="s" x="40" y="54">Nothing is played back. Every voice is computed live, on the device.</text>

<!-- ── ОДИН ГОЛОС ── -->
<text class="cap" x="40" y="88">ONE VOICE</text>

<rect class="src" x="40" y="100" width="190" height="52" rx="7"/>
<text class="n" x="56" y="122" fill="var(--pad)">2 oscillators</text>
<text class="u" x="56" y="139">triangle, ±8 cents apart</text>
<path class="gl" d="M186 132 l7 -12 7 24 7 -24 7 12" opacity=".7"/>

<path class="w" d="M230 126 H252"/><path class="head" d="M252 122 l9 4 -9 4 z"/>

<rect class="box" x="262" y="100" width="104" height="52" rx="7"/>
<text class="n" x="278" y="122">volume</text>
<text class="u" x="278" y="139">shaped, never set</text>

<path class="w" d="M366 126 H392"/><path class="head" d="M392 122 l9 4 -9 4 z"/>
<text class="u" x="406" y="130">into the layer, eight times over</text>

<!-- врезка: что двигает громкость -->
<path class="mod" d="M314 178 V158"/><path d="M310 158 l4 -9 4 9 z" fill="var(--mod)"/>
<rect class="pan" x="40" y="178" width="912" height="104" rx="8"/>
<text class="n" x="58" y="202" fill="var(--mod)">what moves it</text>
<text class="u" x="58" y="219">two slow waves,</text>
<text class="u" x="58" y="234">{P1:.0f} s and {P2:.0f} s</text>
<text class="u" x="58" y="258">their sum, cut</text>
<text class="u" x="58" y="273">below zero</text>
<path class="sine" d="{sine_a}"/>
<path class="sine2" d="{sine_b}"/>
<path class="env" d="{env_path}"/>

<text class="s" x="40" y="304">{P2:.0f} = {P1:.0f} × 1.618 — the two never line up again, so the voice keeps fading in and out and the pad never loops. No switch is ever thrown, so nothing ever clicks.</text>

<!-- ── ВЕСЬ СЛОЙ ── -->
<text class="cap" x="40" y="344">THE WHOLE LAYER</text>

<rect class="src" x="40" y="356" width="188" height="38" rx="7"/>
<text class="n" x="56" y="380" fill="var(--pad)">the 8 voices</text>

<rect class="src" x="40" y="402" width="188" height="38" rx="7"/>
<text class="u" x="56" y="426" fill="var(--pad)">pulse · wanderer · motifs</text>

<path class="w" d="M228 375 H244 M228 421 H244 M244 375 V421 M244 398 H268"/>
<path class="head" d="M268 394 l9 4 -9 4 z"/>

<rect class="box" x="278" y="372" width="104" height="52" rx="7"/>
<text class="n" x="294" y="394">HP 150 Hz</text>
<path class="w" d="M294 412 q11 0 17 -9 t17 -9" opacity=".6"/>

<path class="w" d="M382 398 H404"/><path class="head" d="M404 394 l9 4 -9 4 z"/>

<rect class="box" x="414" y="372" width="112" height="52" rx="7"/>
<text class="n" x="430" y="394">LP ~1.2 kHz</text>
<text class="u" x="430" y="412">slowly drifting</text>

<path class="w" d="M526 398 H556"/>
<circle cx="556" cy="398" r="3.5" fill="var(--line)"/>
<path class="w" d="M556 398 H742"/><path class="head" d="M742 394 l9 4 -9 4 z"/>
<text class="u" x="620" y="390">dry 0.5</text>

<path class="w" d="M556 398 V444 H572"/><path class="head" d="M572 440 l9 4 -9 4 z"/>
<rect class="box" x="582" y="424" width="108" height="38" rx="7"/>
<text class="n" x="598" y="448">reverb 6 s</text>
<path class="w" d="M690 444 H716 V402"/>
<text class="u" x="708" y="418" text-anchor="end">×0.9</text>

<rect class="dst" x="752" y="368" width="200" height="60" rx="8"/>
<text class="n" x="768" y="392" fill="var(--warm)">engine.master</text>
<text class="u" x="768" y="411">the brown noise is already here</text>
</svg>
"""

with open(OUT, "w", encoding="utf-8") as f:
    f.write(SVG)
print(f"записано: {OUT}  ({len(SVG)} байт)")
