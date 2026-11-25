#!/bin/bash
# name source targetTris mode texSize metallic roughness [glow alpha]
set -e
cd /home/claude/tools
O=/home/claude/aholo_work/env_opt; T=/home/claude/aholo_work/env_tex; mkdir -p $O $T
one() {
  name=$1 src=$2 tris=$3 mode=$4 size=$5 met=$6 rough=$7 glow=${8:-0} alpha=${9:-1}
  node simplify.mjs /tmp/env_$src.w.glb /tmp/$name.s.glb $tris 0.05 0.5 > $T/$name.log 2>&1
  python3 -I recolor.py /tmp/$name.s.glb $T $name $mode $size >> $T/$name.log 2>&1
  em=-
  if [ "$glow" != "0" ]; then
    python3 -I -c "from PIL import Image, ImageEnhance; im=Image.open('$T/${name}_base.jpg').convert('RGB'); ImageEnhance.Brightness(im).enhance($glow).resize((256,256)).save('$T/${name}_em.jpg', quality=85)"
    em=$T/${name}_em.jpg
  fi
  node finalize.mjs /tmp/$name.s.glb $O/$name.glb $T/${name}_base.jpg $met $rough $em 1 $alpha >> $T/$name.log 2>&1
  echo "$name ok"
}
one spectral_echo ffdd7006-tex_mesh_4 2500 cyan 512 0 0.9 0.55 0.62 &
one astro_rings 55650b7a-tex_mesh_5 3000 silver 512 0.5 0.4 &
one chamber_door 2572364c-tex_mesh_6 4000 stone 1024 0 0.8 &
one gothic_arch d9821039-tex_mesh_7 3000 stone 1024 0 0.8 &
one gothic_window f7d74e79-tex_mesh_8 2500 stone 1024 0 0.7 0.45 &
one gothic_pillar 2efe0a6d-tex_mesh_9 2500 stone 512 0 0.8 &
one floating_candle 8220d2a4-tex_mesh_10 300 pale 256 0 0.6 &
one astro_clock dbca88c7-tex_mesh_11 4000 silver 1024 0.4 0.45 &
wait
