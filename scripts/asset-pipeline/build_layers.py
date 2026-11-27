"""Intensity layers for the adaptive score (original, synthesized). One layer per combat phase,
with exactly the same tempo, chords and loop length as the phase loop in build_score.py, so the
two stay locked together (both start at scene load). The game raises a layer as the player's
vitality falls (audio.ts): taiko ensemble, brass stabs, tremolo strings with a dissonant edge,
ticking clock, risers. usage: python build_layers.py <repoDir>
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import build_score as B

F32 = np.float32


def brass(m, dur, gain=1.0):
    """Synth brass stab: saw harmonics whose brightness blooms on the attack and closes after."""
    f0 = B.hz(m)
    n = int((dur + 0.25) * B.SR)
    t = B.tt(n)
    out = np.zeros(n, F32)
    cut = 700 + 3200 * np.exp(-t / 0.18)
    for det in (1.0, 1.004, 0.996):
        ph = 2 * np.pi * f0 * det * t
        for k in range(1, int(5000 / f0) + 1):
            out += (1 / k) * np.exp(-(k * f0) / cut) * np.sin(k * ph)
    env = B.adsr(n, 0.02, 0.2) * (0.65 + 0.35 * np.exp(-t / 0.3))
    return out * env * gain / 3


def tremolo(m, dur, rate=12.0, gain=1.0):
    s = B.strings(m, dur, a=0.3, r=0.4, voices=4, bright=3600)
    t = B.tt(len(s))
    return s * (0.55 + 0.45 * np.abs(np.sin(np.pi * rate * t))) * gain


def taiko(gain=1.0):
    n = int(0.9 * B.SR)
    t = B.tt(n)
    f = 70 + 90 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / B.SR) * np.exp(-t / 0.28)
    skin = B.bp(B.rng.standard_normal(n).astype(F32), 120, 900) * np.exp(-t / 0.05)
    return (body + skin * 0.6) * gain


def riser(dur, gain=1.0):
    n = int(dur * B.SR)
    t = B.tt(n)
    x = B.hp(B.rng.standard_normal(n).astype(F32), 800) * (t / dur) ** 2.5
    f = 220 * 2 ** (t / dur * 2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / B.SR) * (t / dur) ** 2 * 0.3
    return (x * 0.5 + tone) * gain


def layer(bpm, prog, density):
    beat = 60 / bpm
    bar = 4 * beat
    T = B.Track(bar * len(prog), 5)
    for b, ch in enumerate(prog):
        t0 = b * bar
        r = B.root(ch)
        # taiko ensemble: every beat, plus syncopated eighths (denser in later phases)
        for e in range(8):
            if e % 2 == 0 or (density >= 2 and e in (3, 7)) or density >= 3:
                T.add(t0 + e * beat / 2, taiko(0.9 if e % 2 == 0 else 0.55), pan=-0.2 + 0.4 * (e % 2))
        T.add(t0, B.bigdrum(0.9))
        if density >= 2:
            T.add(t0 + 2 * beat, B.bigdrum(0.7))
        # brass stabs on the chord: 1, the and-of-2, 4
        for pos in (0, 1.5, 3) if density >= 2 else (0, 2):
            for mm in ch:
                T.add(t0 + pos * beat, brass(mm - 12, beat * 0.55, 0.55), pan=0.15)
            T.add(t0 + pos * beat, brass(r, beat * 0.55, 0.6), pan=-0.1)
        # tremolo strings high, with a minor-second edge (tension) against the chord's fifth
        T.add(t0, tremolo(ch[2] + 24, bar - 0.05, 12 + 2 * density, 0.35), pan=0.35)
        T.add(t0, tremolo(ch[2] + 25, bar - 0.05, 12 + 2 * density, 0.16), pan=-0.35)
        # ticking clock: sixteenths, time running out
        for e in range(16):
            T.add(t0 + e * beat / 4, B.tick(e % 4 == 0, 0.22 if e % 4 == 0 else 0.11), pan=0.55)
        # riser into every fourth bar
        if b % 4 == 3:
            T.add(t0, riser(bar, 0.5))
    return B.finish_loop(T, (2.2, 0.22))


if __name__ == '__main__':
    B.write('score_p1_x', layer(72, [B.Dm, B.Dm, B.Bb, B.Bb, B.Gm, B.Gm, B.A7, B.A7], 1), -19)
    B.write('score_p2_x', layer(92, [B.Dm, B.Bb, B.Gm, B.A7] * 3, 2), -18)
    B.write('score_final_x', layer(104, [B.Dm, B.Bb, B.F, B.C, B.Gm, B.Bb, B.A7, B.A7, B.Dm, B.Bb, B.Gm, B.A7], 3), -17)
