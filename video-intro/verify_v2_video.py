"""Inspect the exported proxy in a separate Blender process, not the live editor."""
import bpy,json
from pathlib import Path
p=Path(r'D:\Alpha website\video-intro')
c=bpy.data.movieclips.load(str(p/'ALPHA-intro-v2-silent-preview.mp4'))
report={'size':list(c.size),'frames':c.frame_duration,'fps':c.fps,'seconds':c.frame_duration/c.fps}
assert report['size']==[960,540] and report['frames']==480 and report['seconds']==32
(p/'video-v2-validation.json').write_text(json.dumps(report,indent=2))
s=bpy.data.scenes.new('V2 export inspection'); bpy.context.window.scene=s
s.render.resolution_x=960; s.render.resolution_y=540; s.render.resolution_percentage=100; s.render.fps=15
s.sequence_editor_create().strips.new_movie('V2 exported proxy',str(p/'ALPHA-intro-v2-silent-preview.mp4'),channel=1,frame_start=1)
for f,name in [(99,'lineup'),(180,'courses'),(280,'worlds'),(463,'closing')]:
 s.frame_set(f); s.render.filepath=str(p/f'v2-export-{name}.png'); bpy.ops.render.render(write_still=True)
print('VIDEO VERIFIED',json.dumps(report))
