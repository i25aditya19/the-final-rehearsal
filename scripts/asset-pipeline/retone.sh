#!/bin/bash
# Re-tone the optimized models in place (geometry unchanged). Run from tools dir.
set -e
cd /home/claude/tools
R=/home/claude/the-final-rehearsal/assets
T=/home/claude/aholo_work/retone; mkdir -p $T
one() { # file mode size metallic roughness [emissive-from-glass strength] [alpha]
  f=$1; name=$(basename $f .glb); mode=$2; size=$3; met=$4; rough=$5; glass=${6:-0}; alpha=${7:-1}
  cp $f $T/$name.in.glb
  python3 -I recolor.py $T/$name.in.glb $T $name "$mode" $size > $T/$name.log
  em=-
  if [ "$glass" != "0" ]; then
    python3 -I -c "
import numpy as np; from PIL import Image
a=np.asarray(Image.open('$T/${name}_base.jpg').convert('L')).astype(float)/255
g=np.clip((a-0.62)*3.0,0,1)[...,None]*np.array([241,239,234])
Image.fromarray(g.astype('uint8')).resize((256,256)).save('$T/${name}_em.jpg',quality=88)"
    em=$T/${name}_em.jpg
  fi
  node finalize.mjs $T/$name.in.glb $f $T/${name}_base.jpg $met $rough $em $glass $alpha >> $T/$name.log
  echo "$name retoned"
}
# Architecture: lighter ash-grey pillars, stone arches, charcoal-medium door, luminous glass.
one $R/environment/gothic_pillar.glb   "tone:0.42:0.86:0.99:0.99:1.0" 512 0 0.75
one $R/environment/gothic_arch.glb     "tone:0.38:0.80:0.99:0.99:1.0" 1024 0 0.75
one $R/environment/chamber_door.glb    "tone:0.22:0.66:1.0:0.99:0.97" 1024 0 0.7
one $R/environment/gothic_window.glb   "tone:0.34:0.92:1.0:0.99:0.97" 1024 0 0.6 1.0
one $R/environment/astro_clock.glb     "tone:0.40:0.95:0.97:0.99:1.03" 1024 0.12 0.45
one $R/environment/astro_rings.glb     "tone:0.40:0.92:0.97:0.99:1.03" 512 0.12 0.45
one $R/environment/floating_candle.glb "tone:0.62:0.95:1.0:0.98:0.93" 256 0 0.6 0.5
one $R/environment/wall_silhouette.glb "tone:0.30:0.75" 256 0 0.9 0.6 0.4
# Watcher: halos antique silver (no dark metal); robes keep black but show their folds.
one $R/boss/watcher_halo.glb           "tone:0.45:0.95:0.97:0.99:1.03" 512 0.15 0.4
one $R/boss/watcher_body.glb           "tone:0.05:0.40" 1024 0 0.8
