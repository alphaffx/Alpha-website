"""Render V2 proxy; all timing edits are in memory and never saved."""
import bpy
from pathlib import Path
OUT=Path(r'D:\Alpha website\video-intro')
s=bpy.data.scenes['ALPHA | Energetic V2']; bpy.context.window.scene=s
# Render a poster at the original 30 fps timing first.
s.render.resolution_percentage=50; s.eevee.taa_render_samples=16
s.frame_set(65); s.render.filepath=str(OUT/'v2-poster.png'); bpy.ops.render.render(write_still=True)
# Retiming includes camera data and animated background materials.
ids=set(s.objects)
for o in s.objects:
 if o.data: ids.add(o.data)
 if o.type in ['MESH','FONT']:
  for m in o.data.materials:
   if m:
    ids.add(m)
    if m.node_tree: ids.add(m.node_tree)
actions={x.animation_data.action for x in ids if getattr(x,'animation_data',None) and x.animation_data.action}
for a in actions:
 for layer in a.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:
      x,l,r=k.co.x,k.handle_left.x,k.handle_right.x
      k.co.x=(x-1)/2+1; k.handle_left.x=(l-1)/2+1; k.handle_right.x=(r-1)/2+1
s.render.fps=15; s.frame_end=480; s.eevee.taa_render_samples=12
for obj,prop,val in [(s.render.image_settings,'media_type','VIDEO'),(s.render.image_settings,'file_format','FFMPEG'),(s.render.ffmpeg,'format','MPEG4'),(s.render.ffmpeg,'codec','H264'),(s.render.ffmpeg,'constant_rate_factor','HIGH')]:
 assert val in [i.identifier for i in obj.bl_rna.properties[prop].enum_items]
 setattr(obj,prop,val)
s.render.filepath=str(OUT/'ALPHA-intro-v2-silent-preview.mp4')
bpy.ops.render.render(animation=True)
print('V2 PREVIEW COMPLETE',s.render.filepath)
