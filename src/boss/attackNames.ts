// The Watcher's named rites: shown as a crimson title when he casts, with the counter as a hint,
// and invoked aloud the first time in each run (voice files: build_voice.py, keys inv_<kind>).
export type RiteKind = 'gaze' | 'aftershock' | 'stolen' | 'blindspot' | 'observation' | 'volley' | 'pursuit'

export const RITES: Record<RiteKind, { name: string; hint: string; invocation?: string }> = {
  gaze: { name: 'JUDGEMENT OF THE EYE', hint: 'step out of the crimson cone before it locks', invocation: 'Kneel... before my eye.' },
  aftershock: { name: 'THE TOLLING HOUR', hint: 'jump the ring or stand in a pale gap  ·  it tolls twice', invocation: 'Hear the hour toll.' },
  volley: { name: 'EMBERS OF THE ARCHIVE', hint: 'slip between the embers, or jump them', invocation: 'Burn, little moments.' },
  blindspot: { name: 'VEIL OF THE BLIND', hint: 'run to the pale quadrant: he cannot see it', invocation: 'Run... while I still see you.' },
  observation: { name: 'THE ALL-SEEING VERDICT', hint: 'stand in a pale circle of light', invocation: 'Now... I see everything.' },
  stolen: { name: 'THEFT OF THE HOUR', hint: 'shoot the crimson anchor above your echo' },
  pursuit: { name: 'FOOTSTEPS OF THE DAMNED', hint: 'your own past path is coming: keep clear of the crimson trail' }
}
export const FINALE_RITE = { name: 'THE LAST BELL', hint: 'survive his last resistance: jump the ring or use a gap' }
