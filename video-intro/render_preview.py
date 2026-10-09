"""Background-only 960x540, 15 fps proxy. Does not save changes to the blend."""
import bpy
from pathlib import Path
out=Path(r'D:\Alpha website\video-intro')
s=bpy.data.scenes['ALPHA | Website Introduction']; bpy.context.window.scene=s
s.render.resolution_percentage=50; s.eevee.taa_render_samples=8
# Retiming in memory retains the same 45-second duration at half the project fps.
actions={o.animation_data.action for o in s.objects if o.animation_data and o.animation_data.action}
for a in actions:
    for layer in a.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for k in fc.keyframe_points:
                        k.co.x=(k.co.x-1)/2+1
                        k.handle_left.x=(k.handle_left.x-1)/2+1
                        k.handle_right.x=(k.handle_right.x-1)/2+1
s.frame_start=1; s.frame_end=675; s.render.fps=15
fmt=[e.identifier for e in s.render.image_settings.bl_rna.properties['file_format'].enum_items]
assert 'FFMPEG' in fmt
s.render.image_settings.media_type='VIDEO'
s.render.image_settings.file_format='FFMPEG'
for prop,value in [('format','MPEG4'),('codec','H264'),('constant_rate_factor','HIGH')]:
    assert value in [e.identifier for e in s.render.ffmpeg.bl_rna.properties[prop].enum_items]
    setattr(s.render.ffmpeg,prop,value)
s.render.filepath=str(out/'ALPHA-intro-silent-preview.mp4')
bpy.ops.render.render(animation=True)
print('SILENT PREVIEW COMPLETE',s.render.filepath)
