"""The Watcher's voice: original performances synthesized offline with Piper TTS, then processed
into his supernatural voice. Lines are the project's own dialogue.

Voice model: Piper (rhasspy, MIT) "en-us-libritts-high", trained on the LibriTTS corpus
(openslr.org/60, CC BY 4.0). Speaker 498 (a deep voice from the corpus; no real actor imitated).
Download (not in the repo, 137 MB): github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-libritts-high.tar.gz
Processing (numpy/scipy, see below): lowered about 2 semitones (slower, older), two faint delayed
repeats (the 'rehearsed' echo), a breathy whisper layer shaped by the voice, cathedral reverb.

usage: python build_voice.py <repoDir> <modelDir>
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.signal import resample_poly
import build_score as B
from piper import PiperVoice
from piper.config import SynthesisConfig

repo, model_dir = sys.argv[1], sys.argv[2]
voice = PiperVoice.load(f'{model_dir}/en-us-libritts-high.onnx', config_path=f'{model_dir}/en-us-libritts-high.onnx.json')
SPEAKER = 498
SR_TTS = 22050

# key -> (text, length_scale (slower > 1), semitones down, echo amount, reverb mix, gain dB)
LINES = {
    'opening':     ('How many times have we rehearsed this?',            1.12, 2.0, 0.30, 0.30, -16),  # calm, mysterious
    'firstEcho':   ('There you are. Again.',                              1.10, 2.0, 0.22, 0.26, -16),  # curious, amused
    'firstSync':   ('You were never meant to learn that.',                1.05, 2.0, 0.18, 0.24, -16),  # controlled concern
    'corruption':  ('Your past does not belong to you.',                  1.08, 2.5, 0.22, 0.26, -15),  # authoritative
    'reclaimed':   ('How did you take it back?',                          0.95, 1.0, 0.15, 0.22, -16),  # genuine surprise
    'redirected':  ('Impossible.',                                        0.92, 1.0, 0.20, 0.24, -15),  # shocked
    'firsttime':   ('Did you really believe this was the first time?',    1.18, 2.5, 0.35, 0.34, -17),  # quiet, unsettling
    'final':       ('I will not look away!',                              1.05, 3.0, 0.30, 0.36, -13),  # powerful, desperate
    'lowhp':       ('Stop... rewriting... me...',                         1.25, 1.5, 0.28, 0.30, -16),  # weakening
    'victory':     ('A moment... I could not foresee...',                 1.28, 2.5, 0.40, 0.40, -17),  # quiet acceptance
    'pursuit':     ('Even your footsteps belong to me.',                  1.08, 2.5, 0.25, 0.28, -15),
    'resist':      ('No... not this moment...',                           1.15, 2.0, 0.30, 0.32, -15),
}


def tts(text, length_scale):
    cfg = SynthesisConfig(speaker_id=SPEAKER, length_scale=length_scale, noise_scale=0.45, noise_w_scale=0.55)
    a = np.concatenate([c.audio_float_array for c in voice.synthesize(text, syn_config=cfg)]).astype(np.float32)
    return a


def to_sr(a, semis):
    """Resample 22.05k -> 32k while lowering pitch (and tempo) by `semis` semitones."""
    ratio = (B.SR / SR_TTS) * 2 ** (semis / 12)
    up, down = int(round(ratio * 1000)), 1000
    return resample_poly(a, up, down).astype(np.float32)


def watcher(text, ls, semis, echo, rev, gain):
    v = to_sr(tts(text, ls), semis)
    v = np.pad(v, (int(0.05 * B.SR), int(1.6 * B.SR)))
    # gentle EQ: warmth, no harsh top
    v = v + B.lp(v, 180) * 0.35
    v = B.lp(v, 7500, 2)
    # the 'rehearsed' echo: two faint repeats, darker each time
    out = v.copy()
    for d, g in [(0.16, echo), (0.33, echo * 0.55)]:
        k = int(d * B.SR)
        out[k:] += B.lp(v[:-k], 3200) * g
    # whisper layer: breathy noise shaped by the voice's own envelope
    env = np.sqrt(B.lp(v ** 2, 30).clip(0))
    whisper = B.bp(B.rng.standard_normal(len(v)).astype(np.float32), 1800, 6500) * env * 0.55
    st = np.vstack([out + np.roll(whisper, int(0.02 * B.SR)) * 0.6, out + whisper * 0.6]).astype(np.float32)
    st = B.hall(st, 2.8, rev, 4500)
    # trim trailing silence (keep the reverb tail)
    mag = np.abs(st).max(axis=0)
    end = len(mag) - np.argmax(mag[::-1] > 0.002) + int(0.15 * B.SR)
    return st[:, :min(end, st.shape[1])]


if __name__ == '__main__':
    B.OUT = f'{repo}/assets/audio/voice'
    os.makedirs(B.OUT, exist_ok=True)
    for key, (text, ls, semis, echo, rev, gain) in LINES.items():
        B.write(f'w_{key}', watcher(text, ls, semis, echo, rev, gain), gain, 3)
