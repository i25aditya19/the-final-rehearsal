"""Heartbeat cue for the decisive final moment (original, synthesized). usage: python build_heartbeat.py <repoDir>"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import build_score as B  # instruments and writer (its __main__ block does not run on import)

def heartbeat():
    n = int(2.2 * B.SR)
    out = np.zeros(n, B.F32)
    for t0, g in [(0.05, 1.0), (0.33, 0.7)]:   # lub ... dub
        t = B.tt(int(0.5 * B.SR))
        f = 52 + 30 * np.exp(-t / 0.03)
        thump = np.sin(2 * np.pi * np.cumsum(f) / B.SR) * np.exp(-t / 0.11) + B.lp(B.rng.standard_normal(len(t)).astype(B.F32), 160) * np.exp(-t / 0.04) * 0.6
        i = int(t0 * B.SR)
        out[i:i + len(thump)] += thump * g
    return B.mono_once(out, (2.4, 0.3))

B.write('heartbeat', heartbeat(), -14)
