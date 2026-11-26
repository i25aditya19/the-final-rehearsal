"""Original adaptive score + ambience + extra cues for THE FINAL REHEARSAL.
Everything is synthesized from scratch with numpy (additive strings, pipe organ, formant choir,
piano, timpani, drums, bells, clock mechanism, whispers). No samples, no third-party audio:
the output is original work under the project's MIT licence.

Tracks (stereo OGG Vorbis, 32 kHz) written to assets/audio/:
  score_entry.ogg    loop 32 s     chamber entry: distant choir, clock ticking, sparse piano
  score_intro.ogg    one-shot 9 s  boss introduction: organ swell + timpani roll to a full hit
  score_p1.ogg       loop          phase I: tense strings ostinato, controlled timpani/frame drum
  score_p2.ogg       loop          phase II: faster strings, melody, heavier drums, organ
  score_final.ogg    loop          phase III: choir, full organ, strings, cinematic drums
  score_victory.ogg  one-shot 16 s magical orchestral resolution (D major), bells
  score_defeat.ogg   one-shot 11 s fading strings, then a clock that slows and stops
  ambience.ogg       loop 40 s     distant bells, clock mechanism, faint whispers, air
  impact / echo_form / echo_fade / ui .ogg   extra gameplay and UI cues (mono)
All loops are rendered with their tails wrapped to the start, so they repeat seamlessly.
Key: D minor. usage: python build_score.py <repoDir>
"""
import sys, os, math, subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

repo = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = f'{repo}/assets/audio'
os.makedirs(OUT, exist_ok=True)
SR = 32000
rng = np.random.default_rng(2026)
F32 = np.float32


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n, dtype=F32) / SR


def lp(x, f, o=2):
    return sosfilt(butter(o, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f, o=2):
    return sosfilt(butter(o, f, btype='high', fs=SR, output='sos'), x)


def bp(x, lo, hi, o=2):
    return sosfilt(butter(o, [lo, hi], btype='band', fs=SR, output='sos'), x)


def adsr(n, a, r, hold=None):
    """Attack a, sustain until n - r, release r (seconds)."""
    e = np.ones(n, F32)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def phase_of(f0, n, vib_rate=0.0, vib_depth=0.0, vib_delay=0.25, drift=0.0):
    t = tt(n)
    vd = vib_depth * np.clip(t / max(vib_delay, 1e-3), 0, 1)
    f = f0 * (1 + vd * np.sin(2 * np.pi * vib_rate * t + rng.random() * 6.28) + drift * np.sin(2 * np.pi * 0.31 * t + rng.random() * 6.28))
    return 2 * np.pi * np.cumsum(f) / SR


# ------------------------------------------------------------------ instruments
def strings(m, dur, a=0.12, r=0.35, voices=4, bright=2600.0, gain=1.0):
    f0 = hz(m)
    n = int((dur + r) * SR)
    out = np.zeros(n, F32)
    K = max(1, int(min(6500, SR / 2 - 800) / f0))
    k = np.arange(1, K + 1)
    amps = (1.0 / k) * np.exp(-k * f0 / bright)
    for v in range(voices):
        det = 2 ** (rng.uniform(-9, 9) / 1200)
        ph = phase_of(f0 * det, n, 5.4 + rng.uniform(-0.4, 0.4), 0.0035, 0.3)
        for kk, am in zip(k, amps):
            out += am * np.sin(kk * ph)
    out *= adsr(n, a, r) * gain / voices
    return out


def organ(m, dur, a=0.25, r=0.6, gain=1.0):
    f0 = hz(m)
    n = int((dur + r) * SR)
    out = np.zeros(n, F32)
    for ratio, am in [(1, 1), (2, 0.75), (3, 0.45), (4, 0.4), (6, 0.22), (8, 0.18), (0.5, 0.5)]:
        if f0 * ratio > SR / 2 - 1000:
            continue
        for det in (1.0, 1.0012):
            out += am * np.sin(phase_of(f0 * ratio * det, n, 6.0, 0.0008, 0.0))
    out *= adsr(n, a, r) * gain / 6
    return out


VOWELS = {'ah': [(730, 110, 1.0), (1090, 120, 0.55), (2440, 180, 0.28), (3400, 260, 0.1)],
          'oo': [(320, 70, 1.0), (800, 100, 0.35), (2240, 160, 0.12)],
          'eh': [(530, 90, 1.0), (1840, 140, 0.45), (2480, 180, 0.25)]}


def choir(m, dur, vowel='ah', a=0.5, r=0.9, voices=5, gain=1.0):
    f0 = hz(m)
    n = int((dur + r) * SR)
    out = np.zeros(n, F32)
    K = max(1, int(5000 / f0))
    k = np.arange(1, K + 1)
    fk = k * f0
    envf = sum(A * np.exp(-((fk - F) / B) ** 2) for F, B, A in VOWELS[vowel]) + 0.015
    amps = envf / k ** 0.35
    for v in range(voices):
        det = 2 ** (rng.uniform(-14, 14) / 1200)
        ph = phase_of(f0 * det, n, 5.0 + rng.uniform(-0.5, 0.5), 0.006, 0.5, 0.0015)
        for kk, am in zip(k, amps):
            out += am * np.sin(kk * ph)
    breath = bp(rng.standard_normal(n).astype(F32), 600, 3500) * 0.02
    out = (out / voices + breath) * adsr(n, a, r) * gain
    return out


def piano(m, dur=3.0, gain=1.0):
    f0 = hz(m)
    n = int(dur * SR)
    t = tt(n)
    out = np.zeros(n, F32)
    B = 0.00035
    for k in range(1, 13):
        fk = k * f0 * math.sqrt(1 + B * k * k)
        if fk > SR / 2 - 500:
            break
        out += (1 / k ** 1.25) * np.sin(2 * np.pi * fk * t) * np.exp(-t / (2.6 / (1 + 0.45 * k)))
    click = lp(rng.standard_normal(n).astype(F32), 3000) * np.exp(-t / 0.004) * 0.08
    return (out + click) * adsr(n, 0.002, 0.05) * gain


def timpani(m, gain=1.0, dur=2.2):
    f0 = hz(m)
    n = int(dur * SR)
    t = tt(n)
    f = f0 * (1 + 0.03 * np.exp(-t / 0.05))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.9) + 0.4 * np.sin(1.5 * ph) * np.exp(-t / 0.5) + 0.25 * np.sin(1.99 * ph) * np.exp(-t / 0.35)
    hit = lp(rng.standard_normal(n).astype(F32), 900) * np.exp(-t / 0.03) * 0.6
    return (body + hit) * gain


def bigdrum(gain=1.0, dur=1.6):
    n = int(dur * SR)
    t = tt(n)
    f = 44 + 60 * np.exp(-t / 0.06)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    thump = lp(rng.standard_normal(n).astype(F32), 250) * np.exp(-t / 0.05) * 0.9
    return (body + thump) * gain


def framedrum(gain=1.0):
    n = int(0.5 * SR)
    t = tt(n)
    skin = bp(rng.standard_normal(n).astype(F32), 180, 1600) * np.exp(-t / 0.07)
    body = np.sin(2 * np.pi * 170 * t) * np.exp(-t / 0.09) * 0.6
    return (skin * 0.8 + body) * gain


def swell(dur, gain=1.0):
    """Reverse cymbal-like rising wash before a phrase."""
    n = int(dur * SR)
    x = hp(rng.standard_normal(n).astype(F32), 3500) * np.linspace(0, 1, n) ** 3
    return x * gain


def bell(m, dur=5.0, gain=1.0):
    f0 = hz(m)
    n = int(dur * SR)
    t = tt(n)
    out = np.zeros(n, F32)
    for ratio, am, tau in [(0.5, 0.5, 3.5), (1, 1, 2.6), (1.19, 0.4, 2.0), (1.5, 0.35, 1.6), (2.0, 0.5, 1.4), (2.74, 0.3, 0.9), (4.07, 0.15, 0.5)]:
        out += am * np.sin(2 * np.pi * f0 * ratio * t) * np.exp(-t / tau)
    return out * adsr(n, 0.002, 0.2) * gain


def tick(hi=True, gain=1.0):
    n = int(0.06 * SR)
    t = tt(n)
    lo, up = (2600, 7000) if hi else (1300, 3800)
    x = bp(rng.standard_normal(n).astype(F32), lo, up, 3) * np.exp(-t / 0.005)
    x += np.sin(2 * np.pi * (3200 if hi else 1900) * t) * np.exp(-t / 0.008) * 0.4
    return x * gain


def whisper(dur, gain=1.0):
    n = int(dur * SR)
    t = tt(n)
    x = rng.standard_normal(n).astype(F32)
    out = np.zeros(n, F32)
    for (F, B, A) in [(900, 300, 1.0), (1900, 500, 0.6), (3100, 700, 0.35)]:
        out += bp(x, max(80, F - B), F + B) * A
    syll = np.clip(np.sin(2 * np.pi * 3.1 * t + rng.random() * 3) ** 2, 0, 1) * np.sin(np.pi * t / dur)
    return hp(out * syll, 500) * gain


# ------------------------------------------------------------------ mixing helpers
class Track:
    def __init__(self, seconds, tail=6.0):
        self.L = int(seconds * SR)
        self.buf = np.zeros((2, self.L + int(tail * SR)), F32)

    def add(self, sec, x, pan=0.0, gain=1.0):
        i = int(sec * SR)
        if i >= self.buf.shape[1]:
            return
        x = x[: self.buf.shape[1] - i] * gain
        lg, rg = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        self.buf[0, i:i + len(x)] += x * lg * 1.414
        self.buf[1, i:i + len(x)] += x * rg * 1.414


def hall(st, sec=3.2, mix=0.32, damp=5000):
    n = int(sec * SR)
    out = np.empty_like(st)
    for ch in range(2):
        ir = lp(rng.standard_normal(n).astype(F32), damp) * np.exp(-np.arange(n) / SR / (sec / 6.5))
        ir[: int(0.012 * SR)] = 0  # pre-delay
        ir /= np.sqrt(np.sum(ir ** 2))
        wet = fftconvolve(st[ch], ir)[: st.shape[1]]
        out[ch] = st[ch] * (1 - mix) + wet * mix * 1.6
    return out


def master(st, rms_db=-19.0, ceiling=0.97):
    rms = np.sqrt(np.mean(st ** 2)) + 1e-9
    st = st * (10 ** (rms_db / 20) / rms)
    return np.tanh(st / ceiling) * ceiling  # soft limiter


def finish_loop(trk, rev=(3.2, 0.32)):
    st = hall(trk.buf, *rev)
    tail = st.shape[1] - trk.L
    st[:, :tail] += st[:, trk.L:]
    return st[:, :trk.L]


def finish_once(trk, rev=(3.2, 0.32), fade=1.5):
    st = hall(trk.buf, *rev)
    nf = int(fade * SR)
    st[:, -nf:] *= np.linspace(1, 0, nf)
    return st


def write(name, st, rms_db=-19.0, q=3):
    st = master(st, rms_db)
    wav = f'/tmp/{name}.wav'
    data = (st.T if st.ndim == 2 else st) * 32767
    wavfile.write(wav, SR, data.astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', str(q), f'{OUT}/{name}.ogg'], check=True)
    secs = st.shape[-1] / SR
    print(f'{name}.ogg  {secs:.1f}s  {os.path.getsize(f"{OUT}/{name}.ogg") // 1024} KB')


# Chords as MIDI notes (D minor).
Dm, Bb, Gm, A7, F, C = [50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52], [41, 45, 48], [48, 52, 55]
ROOT = {id(Dm): 38, id(Bb): 34, id(Gm): 31, id(A7): 33, id(F): 29, id(C): 36}


def root(ch):
    return ROOT[id(ch)]


# ------------------------------------------------------------------ 1. chamber entry (32 s loop)
def entry():
    T = Track(32, 8)
    for i, ch in enumerate([Dm, Bb]):
        for j, mm in enumerate(ch + [ch[0] + 12]):
            T.add(i * 16, choir(mm + 12, 15.5, 'oo', a=3.0, r=3.0, voices=4), pan=-0.5 + j * 0.33, gain=0.32)
        T.add(i * 16, organ(root(ch), 15.5, a=3, r=3), gain=0.25)
    for s in range(32):
        T.add(s + 0.0, tick(s % 2 == 0, 0.16), pan=0.35)
    motif = [(1.0, 74), (3.6, 69), (6.2, 77), (8.8, 76), (14.0, 74), (17.0, 70), (19.6, 74), (22.2, 77), (24.8, 76), (28.0, 69)]
    for sec, mm in motif:
        T.add(sec, piano(mm, 4.0), pan=-0.2, gain=0.42)
    return finish_loop(T, (4.0, 0.42))


# ------------------------------------------------------------------ 2. boss introduction (one-shot)
def intro():
    T = Track(9.5, 5)
    n = int(7.4 * SR)
    sw = np.linspace(0, 1, n) ** 2
    for mm in [26, 38, 45, 50, 53, 57, 62]:
        o = organ(mm, 7.4, a=0.3, r=0.2)[:n] * sw
        T.add(0, o, pan=rng.uniform(-0.4, 0.4), gain=0.7)
    t0, gap = 3.0, 0.26
    while t0 < 7.3:
        T.add(t0, timpani(38, 0.25 + 0.75 * (t0 - 3) / 4.3, 1.0), pan=0.1)
        t0 += gap
        gap = max(0.07, gap * 0.9)
    T.add(6.6, swell(0.85, 0.35))
    T.add(7.45, bigdrum(1.6))
    T.add(7.45, timpani(38, 1.2))
    for j, mm in enumerate([50, 53, 57, 62]):
        T.add(7.45, choir(mm + 12, 1.6, 'ah', a=0.05, r=1.5, voices=5), pan=-0.45 + j * 0.3, gain=0.5)
        T.add(7.45, organ(mm - 12, 1.6, a=0.03, r=1.5), gain=0.5)
    return finish_once(T, (4.0, 0.35), 2.5)


# ------------------------------------------------------------------ 3. phase I (72 bpm, 8 bars)
def phase1():
    beat = 60 / 72
    bar = 4 * beat
    prog = [Dm, Dm, Bb, Bb, Gm, Gm, A7, A7]
    T = Track(bar * len(prog), 6)
    for b, ch in enumerate(prog):
        t0 = b * bar
        r = root(ch)
        for e in range(8):  # tense eighth-note ostinato in the low strings
            mm = r + (12 if e in (2, 6) else 0) + (7 if e == 5 else 0)
            T.add(t0 + e * beat / 2, strings(mm, beat * 0.42, a=0.015, r=0.12, voices=3, bright=1800), pan=-0.25, gain=0.55)
        if b % 2 == 0:
            for j, mm in enumerate(ch):
                T.add(t0, strings(mm + 12, bar * 2 - 0.2, a=0.6, r=0.8, voices=4, bright=2400), pan=0.3 - j * 0.3, gain=0.3)
        T.add(t0, timpani(r + 12, 0.55), pan=0.1)
        T.add(t0 + 2 * beat, timpani(r + 12, 0.35), pan=0.1)
        T.add(t0 + 3.5 * beat, framedrum(0.35), pan=0.4)
        if b >= 4:
            T.add(t0, choir(ch[2] + 12, bar - 0.1, 'oo', a=0.8, r=0.8, voices=4), pan=-0.4, gain=0.18)
    return finish_loop(T)


# ------------------------------------------------------------------ 4. phase II (92 bpm, 12 bars)
def phase2():
    beat = 60 / 92
    bar = 4 * beat
    prog = [Dm, Bb, Gm, A7] * 3
    melody = [(0, 69), (1, 74), (2, 77), (3, 76), (4, 74), (5, 73), (6, 69), (7.5, 70),
              (8, 70), (9, 74), (10, 77), (11, 79), (12, 77), (13, 76), (14, 73), (15, 76)]
    T = Track(bar * len(prog), 6)
    for b, ch in enumerate(prog):
        t0 = b * bar
        r = root(ch)
        for e in range(16):  # sixteenths
            mm = r + (12 if e % 4 == 2 else 0) + (7 if e % 8 == 5 else 0)
            T.add(t0 + e * beat / 4, strings(mm, beat * 0.21, a=0.01, r=0.08, voices=3, bright=2000), pan=-0.3, gain=0.5)
        for j, mm in enumerate(ch):
            T.add(t0, organ(mm, bar - 0.1, a=0.2, r=0.4), pan=0.25 - j * 0.25, gain=0.32)
        T.add(t0, bigdrum(0.9))
        T.add(t0, timpani(r + 12, 0.6), pan=0.1)
        T.add(t0 + 1.5 * beat, timpani(r + 12, 0.4), pan=0.1)
        T.add(t0 + 2 * beat, timpani(r + 19, 0.5), pan=0.1)
        for e in range(8):
            T.add(t0 + e * beat / 2, framedrum(0.45 if e % 2 else 0.25), pan=0.45)
        if b >= 4:
            for sec, mm in melody:
                if int(sec // 4) == b % 4:
                    T.add(t0 + (sec % 4) * beat, strings(mm, beat * 0.95, a=0.05, r=0.3, voices=5, bright=3200), pan=0.2, gain=0.42)
    T.add(len(prog) * bar - 1.2, swell(1.2, 0.3))
    return finish_loop(T)


# ------------------------------------------------------------------ 5. final phase (104 bpm, 12 bars)
def final():
    beat = 60 / 104
    bar = 4 * beat
    prog = [Dm, Bb, F, C, Gm, Bb, A7, A7, Dm, Bb, Gm, A7]
    top = [74, 74, 72, 76, 74, 77, 76, 73, 81, 77, 79, 76]  # soprano line (one note per bar)
    T = Track(bar * len(prog), 7)
    for b, ch in enumerate(prog):
        t0 = b * bar
        r = root(ch)
        for e in range(16):
            mm = r + (12 if e % 4 == 2 else 0) + (7 if e % 8 in (5, 7) else 0)
            T.add(t0 + e * beat / 4, strings(mm, beat * 0.21, a=0.008, r=0.07, voices=3, bright=2200), pan=-0.3, gain=0.48)
        for j, mm in enumerate(ch + [ch[0] + 12]):
            T.add(t0, choir(mm + 12, bar - 0.05, 'ah', a=0.12, r=0.5, voices=5), pan=-0.5 + j * 0.33, gain=0.33)
            T.add(t0, organ(mm - 12, bar - 0.05, a=0.08, r=0.4), gain=0.22)
        T.add(t0, choir(top[b] + 12, bar - 0.05, 'ah', a=0.1, r=0.6, voices=6), pan=0.1, gain=0.42)
        T.add(t0, strings(top[b], bar - 0.05, a=0.08, r=0.4, voices=5, bright=3400), pan=0.25, gain=0.32)
        T.add(t0, bigdrum(1.0))
        T.add(t0 + 2 * beat, bigdrum(0.8))
        T.add(t0 + 3.5 * beat, bigdrum(0.5))
        T.add(t0, timpani(r + 12, 0.7), pan=0.1)
        for e in range(8):
            T.add(t0 + e * beat / 2, framedrum(0.5 if e % 2 else 0.3), pan=0.45)
        if b in (3, 7, 11):
            tr = t0 + 2 * beat
            while tr < t0 + bar - 0.05:
                T.add(tr, timpani(r + 12, 0.45, 0.8), pan=0.1)
                tr += beat / 4
            T.add(t0 + bar - 1.0, swell(1.0, 0.35))
    return finish_loop(T, (3.0, 0.3))


# ------------------------------------------------------------------ 6. victory (one-shot)
def victory():
    T = Track(16, 6)
    seq = [(0, [50, 54, 57], 38), (3.2, [47, 50, 54], 35), (6.4, [43, 47, 50], 31), (9.0, [45, 49, 52], 33), (11.4, [50, 54, 57, 62], 38)]
    for i, (sec, ch, r) in enumerate(seq):
        dur = (seq[i + 1][0] - sec if i + 1 < len(seq) else 4.6)
        for j, mm in enumerate(ch):
            T.add(sec, choir(mm + 12, dur, 'ah', a=0.6, r=1.2, voices=5), pan=-0.4 + j * 0.27, gain=0.33)
            T.add(sec, strings(mm, dur, a=0.5, r=1.0, voices=5, bright=3000), pan=0.4 - j * 0.27, gain=0.3)
        T.add(sec, strings(r, dur, a=0.4, r=1.0, voices=4, bright=1500), gain=0.4)
        for k, mm in enumerate([ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24]):  # harp-like arpeggio
            T.add(sec + k * 0.18, piano(mm, 3.0), pan=-0.3 + 0.2 * k, gain=0.3)
    for sec, mm in [(11.4, 74), (12.2, 78), (13.0, 81), (13.8, 86)]:
        T.add(sec, bell(mm, 5.0), pan=rng.uniform(-0.5, 0.5), gain=0.35)
    T.add(11.4, timpani(38, 0.7))
    return finish_once(T, (4.5, 0.42), 3.0)


# ------------------------------------------------------------------ 7. defeat (one-shot)
def defeat():
    T = Track(11, 5)
    line = [62, 61, 60, 59, 58, 57]
    for i, mm in enumerate(line):
        T.add(i * 0.9, strings(mm, 1.0, a=0.15, r=0.6, voices=5, bright=2400), pan=0.2, gain=0.42 * (1 - i * 0.12))
        T.add(i * 0.9, strings(mm - 15, 1.0, a=0.2, r=0.6, voices=4, bright=1400), pan=-0.2, gain=0.35 * (1 - i * 0.12))
    d = strings(38, 6.5, a=0.3, r=2.5, voices=4, bright=900)
    T.add(0, d, gain=0.4)
    T.add(0, timpani(38, 0.5))
    t0, gap = 6.0, 0.5
    for k in range(9):  # the clock slows and stops
        T.add(t0, tick(k % 2 == 0, 0.6 - k * 0.04), pan=0.2)
        t0 += gap
        gap *= 1.18
    T.add(t0, bell(50, 3.0, 0.25))
    return finish_once(T, (4.0, 0.4), 1.0)


# ------------------------------------------------------------------ 8. ambience (40 s loop, quiet)
def ambience():
    T = Track(40, 8)
    n = T.L
    t = tt(n)
    air = lp(rng.standard_normal(n).astype(F32), 500) * 0.25 + np.sin(2 * np.pi * 73.4 * t) * 0.05 * (1 + 0.5 * np.sin(2 * np.pi * t / 40))
    T.add(0, air)
    for sec, mm, pan in [(3.0, 45, -0.7), (19.5, 43, 0.7), (31.0, 45, -0.3)]:
        T.add(sec, lp(bell(mm, 8.0), 1800), pan=pan, gain=0.45)  # distant cathedral bells
    for s in range(80):  # clock mechanism: tick-tock every half second, gear ratchets now and then
        T.add(s * 0.5, tick(s % 2 == 0, 0.12), pan=-0.55)
    for sec in [7.2, 15.8, 27.4, 36.1]:
        for k in range(6):
            T.add(sec + k * 0.045, tick(True, 0.06), pan=-0.5)
    for sec, pan in [(10.0, 0.6), (23.0, -0.6), (34.0, 0.3)]:
        T.add(sec, whisper(2.2, 0.35), pan=pan)
    return finish_loop(T, (4.5, 0.5))


# ------------------------------------------------------------------ extra cues (mono)
def mono_once(x, rev=(1.8, 0.28)):
    st = hall(np.vstack([x, x]).astype(F32), *rev)
    return st.mean(axis=0)


def cue_impact():
    n = int(0.9 * SR)
    t = tt(n)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / tau) * a for f, tau, a in [(1568, 0.25, 0.6), (2349, 0.18, 0.45), (3136, 0.12, 0.35), (4186, 0.08, 0.25)])
    x += hp(rng.standard_normal(n).astype(F32), 4000) * np.exp(-t / 0.03) * 0.5
    return mono_once(x)


def cue_echo_form():
    n = int(1.0 * SR)
    t = tt(n)
    f = 880 * 2 ** (t * 1.2)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35) * 0.5 + np.sin(2 * np.pi * 1760 * t) * np.exp(-((t - 0.25) / 0.12) ** 2) * 0.4
    return mono_once(x * adsr(n, 0.01, 0.2), (2.2, 0.4))


def cue_echo_fade():
    n = int(1.1 * SR)
    t = tt(n)
    f = 1760 * 2 ** (-t * 1.5)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(t / 1.0, 0, 1)) * 0.5
    x += bp(rng.standard_normal(n).astype(F32), 2000, 6000) * np.sin(np.pi * np.clip(t / 1.0, 0, 1)) * 0.15
    return mono_once(x, (2.0, 0.4))


def cue_ui():
    x = np.concatenate([tick(True, 0.6), np.zeros(int(0.02 * SR), F32)])
    n = int(0.5 * SR)
    t = tt(n)
    x = np.pad(x, (0, n - len(x))) + np.sin(2 * np.pi * 2093 * t) * np.exp(-t / 0.09) * 0.25
    return mono_once(x, (1.0, 0.2))


if __name__ == '__main__':
    write('score_entry', entry(), -21)
    write('score_intro', intro(), -17)
    write('score_p1', phase1(), -20)
    write('score_p2', phase2(), -19)
    write('score_final', final(), -18)
    write('score_victory', victory(), -18)
    write('score_defeat', defeat(), -19)
    write('ambience', ambience(), -24, 2)
    write('impact', cue_impact(), -16)
    write('echo_form', cue_echo_form(), -18)
    write('echo_fade', cue_echo_fade(), -20)
    write('ui', cue_ui(), -18)
