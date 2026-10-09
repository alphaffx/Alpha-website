"""Render the saved 1080p settings without retiming or saving over the scene."""
import bpy,json,time
from pathlib import Path
out=Path(r'D:\Alpha website\video-intro')
s=bpy.data.scenes['ALPHA | Energetic V2']; bpy.context.window.scene=s
assert (s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage)==(1920,1080,100)
assert s.render.fps==30 and s.frame_end==960
assert s.render.ffmpeg.format=='MPEG4' and s.render.ffmpeg.codec=='H264'
assert s.render.ffmpeg.constant_rate_factor=='HIGH'
started=time.time()
def status(state,frame=None,error=None):
 data={'state':state,'frame':frame,'total_frames':960,'elapsed_seconds':round(time.time()-started),'output':s.render.filepath}
 if error: data['error']=str(error)
 (out/'final-render-status.json').write_text(json.dumps(data,indent=2))
def progress(scene,*args): status('rendering',scene.frame_current)
bpy.app.handlers.render_write.append(progress)
status('starting',1)
try:
 bpy.ops.render.render(animation=True)
 c=bpy.data.movieclips.load(s.render.filepath)
 report={'size':list(c.size),'frames':c.frame_duration,'fps':c.fps,'duration_seconds':c.frame_duration/c.fps}
 assert report['size']==[1920,1080] and report['frames']==960 and report['fps']==30
 (out/'final-video-validation.json').write_text(json.dumps(report,indent=2))
 status('complete',960)
 print('FINAL RENDER COMPLETE',json.dumps(report),flush=True)
except Exception as e:
 status('failed',s.frame_current,e)
 raise
