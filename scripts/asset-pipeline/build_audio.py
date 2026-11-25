"""Original sound effects and music for THE FINAL REHEARSAL, synthesized from scratch with numpy
(no samples, no third-party audio). Writes OGG Vorbis files into assets/audio/.
usage: python build_audio.py <repoDir>
"""
import sys, os, subprocess, math
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

repo = sys.argv[1]
OUT = f'{repo}/assets/audio'
os.makedirs(OUT, exist_ok=True)
SR = 44100
rng = np.random.default_rng(42)


def t(sec):
    return np.arange(int(sec * SR)) / SR


def env(n, a=0.005, d=0.2, s=0.0, r=0.2, sustain_time=0.0):
    a_n, d_n, s_n, r_n = int(a * SR), int(d * SR), int(sustain_time * SR), int(r * SR)
    e = np.concatenate([np.linspace(0, 1, max(1, a_n)), np.linspace(1, s, max(1, d_n)), np.full(s_n, s), np.linspace(s, 0, max(1, r_n))])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def expdecay(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def sine(freq, sec, phase=0.0):
    tt = t(sec)
    if callable(freq):
        ph = 2 * np.pi * np.cumsum(freq(tt)) / SR
        return np.sin(ph + phase)
    return np.sin(2 * np.pi * freq * tt + phase)


def noise(sec):
    return rng.standard_normal(int(sec * SR))


def bandpass(x, lo, hi, order=4):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def lowpass(x, f, order=4):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)


def reverb(x, sec=1.8, mix=0.3, damp=4000):
    n = int(sec * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (sec / 5))
    ir = lowpass(ir, damp, 2)
    wet = fftconvolve(x, ir)
    dry = np.pad(x, (0, len(wet) - len(x)))
    wet /= np.max(np.abs(wet)) + 1e-9
    return dry * (1 - mix) + wet * mix * np.max(np.abs(x))


def bell(f0, sec, partials=((1, 1), (2.0, 0.6), (2.76, 0.45), (5.4, 0.25), (8.93, 0.12)), tau=1.2):
    out = np.zeros(int(sec * SR))
    for ratio, amp in partials:
        out += amp * sine(f0 * ratio, sec) * expdecay(len(out), tau / (0.6 + ratio * 0.25))
    return out


def chord(freqs, sec, attack=0.05, tau=1.4, vib=0.0):
    out = np.zeros(int(sec * SR))
    for f in freqs:
        fm = (lambda tt, f=f: f * (1 + vib * np.sin(2 * np.pi * 5.2 * tt))) if vib else f
        out += sine(fm, sec) + 0.3 * sine((lambda tt, f=f: 2 * f * (1 + vib * np.sin(2 * np.pi * 5.2 * tt))) if vib else 2 * f, sec)
    return out * env(len(out), attack, 0.01, 1.0, 0.0, sec) * expdecay(len(out), tau)


def norm(x, peak=0.85):
    return x / (np.max(np.abs(x)) + 1e-9) * peak


def fade(x, fin=0.005, fout=0.05):
    n = len(x)
    e = np.ones(n)
    a, b = int(fin * SR), int(fout * SR)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if b:
        e[-b:] = np.linspace(1, 0, b)
    return x * e


def write(name, x, peak=0.85, q=4):
    x = fade(norm(x, peak))
    wav = f'/tmp/{name}.wav'
    wavfile.write(wav, SR, (x * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', str(q), f'{OUT}/{name}.ogg'], check=True)
    print(f'{name}.ogg  {len(x) / SR:.2f}s  {os.path.getsize(f"{OUT}/{name}.ogg") // 1024} KB')


def mix(*parts):
    n = max(len(p) for p in parts)
    return sum(np.pad(p, (0, n - len(p))) for p in parts)


def at(x, sec, total):
    out = np.zeros(int(total * SR))
    i = int(sec * SR)
    out[i:i + len(x)] += x[: max(0, len(out) - i)]
    return out


A4 = 440.0
note = lambda n: A4 * 2 ** (n / 12)  # semitones from A4

# ------------------------------------------------------------------ player magic (cyan)
whoosh = bandpass(noise(0.35), 600, 5000) * env(int(0.35 * SR), 0.02, 0.1, 0.4, 0.2, 0.05)
cast = mix(0.5 * whoosh, at(0.6 * bell(note(15), 0.7, tau=0.5), 0.03, 0.75), at(0.3 * bell(note(22), 0.6, tau=0.35), 0.05, 0.75))
write('cast', reverb(cast, 1.0, 0.25), 0.7)
echo = mix(0.35 * bandpass(noise(0.25), 1500, 7000) * expdecay(int(0.25 * SR), 0.06), 0.55 * bell(note(24), 0.5, tau=0.25))
write('echo', reverb(echo, 0.8, 0.35), 0.45)
write('ready', reverb(0.5 * bell(note(27), 0.6, tau=0.3), 0.8, 0.3), 0.3)

# ------------------------------------------------------------------ Convergence (gold): richer chords
for n_echo, notes in ((2, (0, 7)), (3, (0, 4, 7)), (4, (-12, 0, 4, 7, 14))):
    c = chord([note(x) for x in notes], 2.6, 0.02, 1.6, 0.003)
    sweep = bandpass(noise(0.6), 300, 6000) * env(int(0.6 * SR), 0.25, 0.3, 0.0, 0.05)
    shimmer = sum(0.15 * bell(note(19 + 5 * k), 1.5, tau=0.6) for k in range(n_echo))
    write(f'converge{n_echo}', reverb(mix(at(0.5 * sweep, 0, 2.8), at(c, 0.25, 2.8), at(shimmer, 0.28, 2.8)), 2.2, 0.35), 0.85)

# ------------------------------------------------------------------ impacts
thud = sine(lambda tt: 120 * np.exp(-tt * 8) + 45, 0.4) * expdecay(int(0.4 * SR), 0.12)
crackle = highpass(noise(0.2), 2500) * expdecay(int(0.2 * SR), 0.03)
write('hit', mix(thud, 0.3 * crackle), 0.6)
write('deflect', reverb(bell(1150, 0.6, ((1, 1), (1.52, 0.7), (2.08, 0.5), (2.9, 0.3)), tau=0.35), 0.6, 0.25), 0.45)
write('hurt', mix(sine(lambda tt: 90 * np.exp(-tt * 4) + 40, 0.45) * expdecay(int(0.45 * SR), 0.15), 0.4 * lowpass(noise(0.3), 700) * expdecay(int(0.3 * SR), 0.06)), 0.7)

# ------------------------------------------------------------------ Watcher attacks (crimson)
n = int(1.5 * SR)
tt = t(1.5)
centre = 400 * (3000 / 400) ** (tt / 1.5)
w = noise(1.5)
whisper = np.zeros(n)
for k in range(0, n, 2048):  # moving band-pass for a rising whisper
    seg = w[k:k + 2048]
    fc = centre[min(k, n - 1)]
    whisper[k:k + len(seg)] = bandpass(seg, fc * 0.8, min(fc * 1.25, 20000))
whisper *= (0.4 + 0.6 * tt / 1.5) * (0.85 + 0.15 * np.sin(2 * np.pi * 7 * tt))
write('gaze_warn', reverb(whisper, 1.0, 0.3), 0.55)
crack = mix(highpass(noise(0.15), 1500) * expdecay(int(0.15 * SR), 0.02), 0.8 * sine(lambda tt: 1400 * np.exp(-tt * 9) + 120, 0.5) * expdecay(int(0.5 * SR), 0.12))
write('gaze_fire', reverb(crack, 1.2, 0.3), 0.8)
write('bell', reverb(bell(98, 3.5, ((1, 1), (2.0, 0.5), (2.4, 0.5), (3.0, 0.35), (4.2, 0.25), (5.4, 0.15)), tau=2.2), 2.5, 0.35), 0.85)
chime = bell(1480, 1.4, ((1, 1), (1.41, 0.6), (2.23, 0.45), (3.6, 0.25)), tau=0.6)
rev_chime = chime[::-1] * np.linspace(0.2, 1, len(chime))
write('corruption', reverb(mix(rev_chime, at(0.5 * chime[: int(0.4 * SR)], 1.35, 1.8)), 1.5, 0.35), 0.6)
swell = sum(sine(note(x) / 4 * (1 + 0.004 * k), 2.6) for k, x in enumerate((-12, -11, -5))) * np.linspace(0, 1, int(2.6 * SR)) ** 1.5
write('blindspot', reverb(mix(lowpass(swell, 900), 0.2 * bandpass(noise(2.6), 200, 900) * np.linspace(0, 1, int(2.6 * SR))), 1.5, 0.3), 0.7)
choir = chord([note(x) for x in (-12, -9, -5, -2, 1)], 2.4, 1.6, 9.0, 0.006)
choir = lowpass(choir, 2500) * (np.linspace(0, 1, len(choir)) ** 1.2)
boom = at(mix(thud * 1.4, 0.5 * lowpass(noise(0.8), 400) * expdecay(int(0.8 * SR), 0.25)), 2.2, 3.2)
write('observation', reverb(mix(choir, boom), 2.0, 0.35), 0.85)
hum = sine(lambda tt: 70 + 60 * (tt / 1.3) ** 2, 1.3) * np.linspace(0, 1, int(1.3 * SR))
hum += 0.4 * sine(lambda tt: 140 + 120 * (tt / 1.3) ** 2, 1.3) * np.linspace(0, 1, int(1.3 * SR))
write('volley', reverb(mix(hum, at(0.6 * whoosh, 1.25, 1.7)), 1.0, 0.3), 0.6)

# ------------------------------------------------------------------ structure
arp = sum(at(0.4 * bell(note(x), 1.4, tau=0.6), 0.25 + i * 0.12, 3.0) for i, x in enumerate((0, 4, 7, 12, 16, 19)))
write('phase', reverb(mix(bell(110, 3.0, tau=2.0), arp), 2.5, 0.4), 0.85)
glass = sum(at(0.4 * bell(2200 * (1 + 0.37 * k), 0.8, ((1, 1), (1.7, 0.5), (2.9, 0.3)), tau=0.25), 0.02 * k, 1.2) for k in range(7))
shatter = mix(0.6 * highpass(noise(0.5), 3000) * expdecay(int(0.5 * SR), 0.09), glass)
write('gate_break', reverb(mix(shatter, at(chord([note(x) for x in (0, 4, 7)], 2.0, 0.02, 1.2), 0.1, 2.3)), 2.0, 0.35), 0.85)

# Victory: heartbeat, silence, shatter, harmonic resolution (8 s).
beat = sine(lambda tt: 60 * np.exp(-tt * 6) + 38, 0.35) * expdecay(int(0.35 * SR), 0.1)
resolve = chord([note(x) for x in (-12, -5, 0, 4, 7, 11, 14)], 5.0, 0.6, 3.5, 0.004)
victory = mix(at(beat, 0.0, 8.5), at(0.8 * beat, 0.28, 8.5), at(1.6 * shatter, 1.6, 8.5), at(resolve, 2.1, 8.5))
write('victory', reverb(victory, 3.0, 0.4), 0.9)
drone = sum(sine(lambda tt, f=f: f * (1 - 0.08 * tt / 3.5), 3.5) for f in (110, 130.8, 155.6)) * expdecay(int(3.5 * SR), 1.6)
write('defeat', reverb(lowpass(drone, 1200), 2.5, 0.4), 0.7)


# ------------------------------------------------------------------ music (seamless 32 s loops)
def music(final=False, sec=32.0):
    n = int(sec * SR)
    tt = t(sec)
    out = np.zeros(n)
    # drone
    out += 0.35 * lowpass(sine(55, sec) + 0.5 * sine(82.4, sec) + 0.25 * sine(110.3, sec), 400)
    # slow choir-like pad: Am - F - Dm - E, 8 s each, crossfaded
    prog = [(-12, -9, -5), (-16, -12, -9), (-19, -14, -10), (-17, -13, -10)]
    for i, ch in enumerate(prog):
        seg = np.zeros(n)
        start = int(i * 8 * SR)
        length = int(10 * SR)
        idx = (np.arange(length) + start) % n
        pad = sum(sine(lambda tt, f=note(x): f * (1 + 0.004 * np.sin(2 * np.pi * 4.8 * tt)), 10) for x in ch)
        pad = lowpass(pad, 1400) * np.sin(np.linspace(0, np.pi, length)) ** 1.5
        np.add.at(seg, idx, pad)
        out += 0.16 * seg
    # distant clock ticks every second
    tick = highpass(noise(0.03), 3000) * expdecay(int(0.03 * SR), 0.006)
    for s in range(int(sec)):
        i = int(s * SR)
        out[i:i + len(tick)] += (0.05 if s % 2 else 0.035) * tick
    if final:
        # a heartbeat pulse and a dissonant upper layer for phase III
        hb = sine(lambda tt: 55 * np.exp(-tt * 6) + 36, 0.3) * expdecay(int(0.3 * SR), 0.09)
        for s in np.arange(0, sec, 1.0):
            for off, amp in ((0, 0.5), (0.24, 0.35)):
                i = int((s + off) * SR)
                out[i:i + len(hb)] += amp * hb[: max(0, n - i)]
        out += 0.07 * lowpass(sine(note(-11), sec) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.25 * tt)), 1800)
        out += 0.05 * bandpass(noise(sec), 300, 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.125 * tt))
    out = reverb(out, 2.5, 0.3)[:n]
    # make the loop seamless: crossfade the tail into the head
    xf = int(1.5 * SR)
    head = out[:xf].copy()
    out[:xf] = head * np.linspace(0, 1, xf) + out[n - xf:] * np.linspace(1, 0, xf)
    return out[: n - xf]


write('music_chamber', music(False), 0.55, 3)
write('music_final', music(True), 0.6, 3)
