"""ALPHA intro V2: bright studio, shot changes, animated product showcases."""
import bpy, math, random, ast, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(r'D:\Alpha website'); OUT=ROOT/'video-intro'
assert 'ALPHA | Energetic V2' not in bpy.data.scenes
source_rig=next(o for o in bpy.data.scenes['Scene'].objects if o.type=='ARMATURE')
scene=bpy.data.scenes.new('ALPHA | Energetic V2'); bpy.context.window.scene=scene
scene.render.engine=bpy.data.scenes['ALPHA | Website Introduction'].render.engine
scene.render.resolution_x=1920; scene.render.resolution_y=1080; scene.render.resolution_percentage=100
scene.render.fps=30; scene.frame_start=1; scene.frame_end=960
scene.render.filepath=str(OUT/'v2-frames'/'alpha_'); scene.eevee.taa_render_samples=64
scene.world=bpy.data.worlds.new('V2 | Bright studio'); scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs['Color'].default_value=(.65,.83,1,1); bg.inputs['Strength'].default_value=.65
scene.view_settings.exposure=.35

def col(name):
 c=bpy.data.collections.new('V2 | '+name); scene.collection.children.link(c); return c
stage=col('Studio'); graphics=col('Editable motion graphics'); people=col('Mixamo presenter'); models=col('3D model lineup')
def put(o,c=graphics):
 for old in list(o.users_collection): old.objects.unlink(o)
 c.objects.link(o); return o
def rgb(h):
 a=[int(h[i:i+2],16)/255 for i in [0,2,4]]
 return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in a)+(1,)
def mat(name,h,flat=True):
 m=bpy.data.materials.new('V2 | '+name); m.use_nodes=True; n=m.node_tree.nodes
 out=next(x for x in n if x.type=='OUTPUT_MATERIAL')
 if flat:
  p=n.new('ShaderNodeEmission'); p.inputs['Color'].default_value=rgb(h); p.inputs['Strength'].default_value=1.3
 else:
  p=next(x for x in n if x.type=='BSDF_PRINCIPLED'); p.inputs['Base Color'].default_value=rgb(h); p.inputs['Roughness'].default_value=.3
 m.node_tree.links.new(p.outputs[0],out.inputs['Surface']); return m
ink=mat('Ink','092435'); cyan=mat('Electric cyan','13DDE7'); paper=mat('Warm white','F8FCF4'); lime=mat('Lime','DFFB69'); coral=mat('Peach','FFA879'); ice=mat('Ice','B9EDEA'); blue=mat('Blue','2676BA'); dim=mat('Secondary ink','375D6B')
plastic=mat('Cyan plastic','25D4E3',False)
def cube(name,xyz,size,material,c=graphics,bevel=.06):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz); o=put(bpy.context.object,c); o.name='V2 | '+name; o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(material)
 if bevel:
  m=o.modifiers.new('Rounded edges','BEVEL'); m.width=bevel; m.segments=4
 return o
def disc(name,x,z,r,material,y=2):
 bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=r,depth=.035,location=(x,y,z),rotation=(math.pi/2,0,0))
 o=put(bpy.context.object); o.name='V2 | '+name; o.data.materials.append(material); return o
display=bpy.data.fonts.get('impact.ttf') or bpy.data.fonts.load(r'C:\Windows\Fonts\impact.ttf')
bold=bpy.data.fonts.load(r'C:\Windows\Fonts\arialbd.ttf')
def text(name,body,x,z,size,material=ink,font=None,y=-1.4):
 d=bpy.data.curves.new('V2 | '+name,'FONT'); d.body=body; d.size=size; d.space_line=1.02; d.font=font or display
 o=bpy.data.objects.new(d.name,d); graphics.objects.link(o); o.location=(x,y,z); o.rotation_euler=(math.pi/2,0,0); d.materials.append(material); return o
def image(name,path,x,z,w,h=None,y=-.2):
 im=bpy.data.images.load(str(ROOT/path),check_existing=True); ratio=im.size[1]/im.size[0]
 if h: w=min(w,h/ratio)
 h=w*ratio
 m=bpy.data.materials.new('V2 | '+name+' image'); m.use_nodes=True; n=m.node_tree.nodes; n.clear()
 out=n.new('ShaderNodeOutputMaterial'); e=n.new('ShaderNodeEmission'); t=n.new('ShaderNodeTexImage'); t.image=im
 tr=n.new('ShaderNodeBsdfTransparent'); mix=n.new('ShaderNodeMixShader')
 l=m.node_tree.links; l.new(t.outputs['Color'],e.inputs['Color']); l.new(t.outputs['Alpha'],mix.inputs[0]); l.new(tr.outputs[0],mix.inputs[1]); l.new(e.outputs[0],mix.inputs[2]); l.new(mix.outputs[0],out.inputs[0])
 bpy.ops.mesh.primitive_plane_add(size=2,location=(x,y,z),rotation=(math.pi/2,0,0))
 o=put(bpy.context.object); o.name='V2 | '+name; o.scale=(w/2,h/2,1); o.data.materials.append(m); return o
def curves(o):
 a=o.animation_data.action if o.animation_data else None
 if a:
  for layer in a.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     yield from bag.fcurves
def cut_visibility(o,start,end):
 for f,v in [(1,True),(max(1,start-1),True),(start,False),(end,False),(end+1,True)]:
  o.hide_render=v; o.keyframe_insert('hide_render',frame=f)
  o.hide_viewport=v; o.keyframe_insert('hide_viewport',frame=f)
 for fc in curves(o):
  if fc.data_path in ['hide_render','hide_viewport']:
   for k in fc.keyframe_points: k.interpolation='CONSTANT'
def beat(items,start,end,label,slide=.32):
 root=bpy.data.objects.new('V2 | '+label,None); graphics.objects.link(root)
 for o in items:
  o.parent=root; cut_visibility(o,start,end)
 for f,x,z,sc in [(start,slide,-.05,.96),(start+10,-.025,.025,1.012),(start+19,0,0,1),(end,0,0,1)]:
  root.location=(x,0,z); root.scale=(sc,)*3; root.keyframe_insert('location',frame=f); root.keyframe_insert('scale',frame=f)
 return root
def floating(o,start,end,angle=4):
 base=o.rotation_euler.copy(); loc=o.location.copy()
 for f,a,dz in [(start,-angle,0),((start+end)//2,angle,.12),(end,-angle,0)]:
  o.rotation_euler=base; o.rotation_euler.y+=math.radians(a); o.location=loc+Vector((0,0,dz))
  o.keyframe_insert('rotation_euler',frame=f); o.keyframe_insert('location',frame=f)

# A large bright backdrop and a few physical studio accents.
back=cube('Bright backdrop',(0,4,3),(40,.1,25),paper,stage,0)
be=next(n for n in paper.node_tree.nodes if n.type=='EMISSION')
for f,h in [(1,'EBFAEE'),(121,'ADF0ED'),(271,'F8F2DF'),(451,'C2EEF0'),(661,'D9F49A'),(781,'FCE4CD'),(871,'ADF0ED')]:
 be.inputs['Color'].default_value=rgb(h); be.inputs['Color'].keyframe_insert('default_value',frame=f)
for fc in paper.node_tree.animation_data.action.layers[0].strips[0].channelbags[0].fcurves:
 for k in fc.keyframe_points: k.interpolation='CONSTANT'
camd=bpy.data.cameras.new('V2 | Moving landscape camera'); camd.type='ORTHO'; camd.ortho_scale=12
cam=bpy.data.objects.new('V2 | Camera',camd); stage.objects.link(cam); cam.location=(0,-20,3); cam.rotation_euler=(math.pi/2,0,0); scene.camera=cam
shots=[(1,120),(121,270),(271,450),(451,660),(661,780),(781,870),(871,960)]
for i,(a,b) in enumerate(shots):
 for f,scale,x in [(a,12.2,0),(b,11.65,.04 if i%2==0 else -.04)]:
  cam.location.x=x; cam.keyframe_insert('location',frame=f); camd.ortho_scale=scale; camd.keyframe_insert('ortho_scale',frame=f)
 for fc in curves(cam):
  for k in fc.keyframe_points: k.interpolation='LINEAR'
def light(name,xyz,power,color,target=(0,0,3),size=6):
 d=bpy.data.lights.new('V2 | '+name,'AREA'); d.energy=power; d.color=color; d.size=size
 o=bpy.data.objects.new(d.name,d); stage.objects.link(o); o.location=xyz; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
light('Large soft key',(-4,-6,8),1600,(1,.95,.86))
light('Front fill',(5,-5,5),1200,(.72,.9,1))
light('Warm rim',(1,2,7),1900,(1,.7,.35))
light('Centre fill',(0,-4,3),450,(1,1,1))

# Brand bug remains small; the content owns the frame.
text('Brand','ALPHA / 3D SPACE',-5.35,5.85,.2,ink,bold)
text('Address','alphaff.gg',3.9,5.85,.2,ink,bold)
random.seed(18)
for i in range(10):
 x=random.choice([-1,1])*random.uniform(5.25,7); z=random.uniform(.3,5.5)
 o=cube('Floating accent '+str(i),(x,1.4,z),(.16,.16,.65),[cyan,coral,lime][i%3],stage,.04)
 for f in range(1,962,120):
  o.rotation_euler=(f*.008+i,f*.01,f*.003); o.location.z=z+.18*math.sin(f*.016+i); o.keyframe_insert('rotation_euler',frame=f); o.keyframe_insert('location',frame=f)

# The original Mixamo rig is duplicated into V2.
rig=source_rig.copy(); rig.data=source_rig.data.copy(); rig.animation_data_clear(); people.objects.link(rig); rig.name='V2 | ALPHA Mixamo'
children=[]
for old in source_rig.children_recursive:
 if old.type=='MESH':
  o=old.copy(); o.data=old.data.copy(); o.animation_data_clear(); people.objects.link(o); o.parent=rig; o.name='V2 | ALPHA presenter'; children.append(o)
  for mod in o.modifiers:
   if mod.type=='ARMATURE': mod.object=rig
for p in rig.pose.bones: p.rotation_mode='QUATERNION'; p.matrix_basis=Matrix.Identity(4)
for f,x,z,s in [(1,-3.15,-1.15,5.8),(120,-3.15,-1.15,5.8),(121,15,0,5.8),(270,15,0,5.8),(271,3.95,-1.05,5.55),(450,3.95,-1.05,5.55),(451,15,0,5.55),(660,15,0,5.55),(661,3.65,-1.15,5.7),(780,3.65,-1.15,5.7),(781,-3.15,-.95,5.5),(870,-3.15,-.95,5.5),(871,3.65,-1.15,5.7),(960,3.65,-1.15,5.7)]:
 rig.location=(x,0,z); rig.scale=tuple(k*s for k in source_rig.scale); rig.keyframe_insert('location',frame=f); rig.keyframe_insert('scale',frame=f)
for fc in curves(rig):
 for k in fc.keyframe_points: k.interpolation='CONSTANT'

def aim(name,direction):
 p=rig.pose.bones['mixamorig:'+name]; bpy.context.view_layer.update()
 d=rig.matrix_world.to_3x3().inverted() @ Vector(direction); m=p.matrix.copy()
 q=m.to_3x3().col[1].normalized().rotation_difference(d.normalized()); out=(q.to_matrix() @ m.to_3x3()).to_4x4(); out.translation=m.translation
 p.matrix=out; bpy.context.view_layer.update()
def gesture(frame,kind,amount=0):
 scene.frame_set(frame)
 for p in rig.pose.bones: p.matrix_basis=Matrix.Identity(4)
 # Small chest leans and head tilts support the hands, without sliding the feet.
 rig.pose.bones['mixamorig:Spine2'].rotation_quaternion=Quaternion((0,0,1),math.radians(amount*3.5))
 rig.pose.bones['mixamorig:Head'].rotation_quaternion=Quaternion((0,1,0),math.radians(amount*7)) @ Quaternion((0,0,1),math.radians(amount*3))
 left=[(.28,-.1,-1),(.12,-.3,-1),(.1,-.18,-1)]; right=[(-.28,-.1,-1),(-.12,-.3,-1),(-.1,-.18,-1)]
 pointing=None; waving=None
 if kind=='hello': right=[(-.65,-.2,.55),(-.1+amount*.2,-.15,1),(.1+amount*.2,-.1,1)]; waving='Right'
 if kind=='point-right': left=[(.8,-.2,-.3),(1,-.1,.32),(1,-.1,.25)]; pointing='Left'
 if kind=='point-left': right=[(-.65,-.2,-.4),(-1,-.1,.4),(-1,-.1,.3)]; pointing='Right'
 if kind=='idea': left=[(.65,-.2,-.55),(.1,-.3,1),(.05,-.2,1)]; pointing='Left'
 if kind=='open': left=[(.55,-.2,-.5),(.75,-.6,.4),(.8,-.3,.2)]; right=[(-.55,-.2,-.5),(-.75,-.6,.4),(-.8,-.3,.2)]
 if kind=='sweep': right=[(-.55,-.25,-.5),(-.7,-.55,.6),(-.8,-.25,.45)]
 if kind=='yes': right=[(-.35,-.3,-.6),(-.05,-.55,1),(-.1,-.5,.9)]
 for side,dirs in [('Left',left),('Right',right)]:
  for part,d in zip(['Arm','ForeArm','Hand'],dirs): aim(side+part,d)
  for finger in ['Index','Middle','Ring','Pinky']:
   for j in [1,2,3]:
    p=rig.pose.bones['mixamorig:'+side+'Hand'+finger+str(j)]
    curl=.08 if kind!='yes' else .9
    if side==pointing: curl=0 if finger=='Index' else .85
    p.rotation_quaternion=Quaternion((1,0,0),curl)
  if side==pointing:
   for j in [1,2,3]: aim(side+'HandIndex'+str(j),dirs[-1])
  if side==waving:
   for finger in ['Index','Middle','Ring','Pinky']:
    for j in [1,2,3]: aim(side+'Hand'+finger+str(j),dirs[-1])
 for p in rig.pose.bones: p.keyframe_insert('rotation_quaternion',frame=frame,group=p.name)
poses=[(1,'hello',-.7),(15,'hello',.7),(30,'hello',-.6),(44,'hello',.4),(60,'open',.4),(83,'point-right',-.3),(110,'open',.2),(120,'open',.2),
 (271,'idea',.4),(300,'idea',-.3),(323,'point-left',-.6),(349,'point-left',.4),(377,'sweep',-.3),(409,'yes',.5),(436,'open',-.3),(450,'open',-.3),
 (661,'sweep',-.4),(685,'point-left',.3),(720,'point-left',-.5),(752,'yes',.4),(780,'yes',.4),
 (781,'open',-.5),(804,'point-right',.4),(830,'idea',-.4),(857,'open',.5),(870,'open',.5),
 (871,'sweep',-.4),(895,'point-left',.3),(922,'hello',-.4),(940,'hello',.4),(960,'open',.2)]
for f,k,v in poses: gesture(f,k,v)
rig.animation_data.action.name='V2 | Animated host - greeting, idea, sweep, point, celebration'
for a,b,sign in [(1,120,1),(271,450,-1),(661,780,-1),(781,870,1),(871,960,-1)]:
 for f,v in [(a,-.06*sign),(a+24,.09*sign),(a+53,-.04*sign),(b,.035*sign)]:
  rig.rotation_euler.z=v; rig.keyframe_insert('rotation_euler',frame=f)

# 0–4s: a big, welcoming character and only a few words.
before=set(graphics.objects)
disc('Welcome disc',-3.2,3.1,3.05,cyan,2)
disc('Welcome small disc',4.8,.35,.65,lime,1)
text('Opening headline',"LET'S\nMAKE IT.",-.25,4.42,1.28)
text('Opening subline','FREE FIRE. YOUR WAY.',-.15,1.4,.28,dim,bold)
cube('Opening underline',(2.2,-1.1,1.06),(4.75,.04,.09),cyan)
text('Opening tag','MODELS + SKILLS + WORLDS',-.15,.55,.22,ink,bold)
beat(set(graphics.objects)-before,1,120,'01 HELLO',.18)

# 4–9s: three real downloadable 3D models fill the frame.
before=set(graphics.objects)
text('Lineup title','PICK YOUR CHARACTER.',-5.15,5.05,.77)
text('Lineup caption','PREVIEW IN 3D  /  FREE DOWNLOADS',-3.07,.02,.22,ink,bold)
beat(set(graphics.objects)-before,121,270,'02 FREE MODELS')
for idx,(slug,x,label) in enumerate([('beesto',-3.5,'BEESTO'),('alpha',0,'ALPHA'),('luna',3.5,'LUNA')]):
 with bpy.data.libraries.load(str(ROOT/'models'/f'{slug}.blend'),link=False) as (a,b): b.objects=a.objects
 imported=[]
 for o in b.objects:
  if o:
   models.objects.link(o)
   if o.type=='MESH': imported.append(o)
 bpy.context.view_layer.update()
 corners=[o.matrix_world @ Vector(c) for o in imported for c in o.bound_box]
 mn=Vector(tuple(min(v[k] for v in corners) for k in range(3))); mx=Vector(tuple(max(v[k] for v in corners) for k in range(3)))
 root=bpy.data.objects.new('V2 | '+slug+' turntable',None); models.objects.link(root)
 ratio=3.55/(mx.z-mn.z)
 for o in imported:
  world=o.matrix_world.copy(); o.parent=root; o.matrix_world=world; cut_visibility(o,121,270)
 root.scale=(ratio,)*3; root.location=(x,0,.55-mn.z*ratio)
 for f,angle in [(121,-.28),(185,.12),(270,.65)]: root.rotation_euler.z=angle; root.keyframe_insert('rotation_euler',frame=f)
 before=set(graphics.objects)
 disc(slug+' halo',x,2.5,1.65,[coral,lime,cyan][idx],2.1)
 labelobj=text(slug+' label',label,x-.65,.48,.28)
 beat(set(graphics.objects)-before,121,270,'02 '+label,(-.2 if idx%2 else .2))

# 9–15s: generously sized, floating course covers and a closer host on the right.
before=set(graphics.objects)
text('Courses title','LEARN THE MOVES.',-5.2,5.05,.77)
disc('Courses halo',4.1,2.9,2.5,coral,2.1)
a=image('English course cover',Path('media/store/free-fire-blender-en/1.webp'),-3.55,2.72,2.95,3.0)
b=image('French course cover',Path('media/store/free-fire-blender-fr/1.webp'),-.35,2.72,3.15,3.0)
floating(a,271,450,3); floating(b,271,450,-3)
text('Languages','ENGLISH + FRENCH',-5.05,.6,.29)
text('Course detail','Free introduction. Paid courses.',-1.83,.63,.21,dim,bold)
beat(set(graphics.objects)-before,271,450,'03 LEARN',-.4)

# 15–22s: landscape product imagery takes over; every map gets a beat.
maps=[('bermuda','BERMUDA',2),('alpine','ALPINE',3),('old-peak','OLD PEAK',2),('football-factory','FOOTBALL FACTORY',2),('social-island','SOCIAL ISLAND',2),('lone-wolf','LONE WOLF',2)]
for idx,(slug,label,imgidx) in enumerate(maps):
 a=451+idx*35; b=a+34
 before=set(graphics.objects)
 artwork=image('World '+label,Path('media/store')/slug/(str(imgidx)+'.webp'),0,2.95,11.4,6.5,y=.5)
 for f,sc,x in [(a,1,0),(b,1.08,-.1 if idx%2 else .1)]:
  artwork.scale.x*=sc; artwork.scale.y*=sc; artwork.location.x=x; artwork.keyframe_insert('scale',frame=f); artwork.keyframe_insert('location',frame=f)
 cube('Map headline backing',(0,-.9,5.27),(11.8,.1,.88),ink)
 text('Map headline','BUILD YOUR WORLD.',-5.2,5.02,.7,cyan)
 cube('Map label backing',(-2.85,-.9,.64),(4.7,.1,.75),lime)
 text('Map name',label,-5.0,.43,.42,ink)
 text('Map counter',f'0{idx+1} / 06',4.1,.43,.28,ink,bold)
 beat(set(graphics.objects)-before,a,b,'04 MAP '+label,.08)

# 22–26s: one clear resource, filling most of the shot.
before=set(graphics.objects)
disc('HUD halo',3.7,2.8,2.6,cyan,2)
text('HUD title','DIAL IT IN.',-5.2,5.05,.95)
im=image('HUD showcase',Path('media/store/pro-hud/1.webp'),-1.88,2.72,6.3,3.35)
floating(im,661,780,2)
text('HUD caption','EMULATOR HUD + SENSITIVITY',-5.0,.55,.31)
beat(set(graphics.objects)-before,661,780,'05 HUD',-.3)

# 26–29s: direct invitation, with a new composition.
before=set(graphics.objects)
disc('Commission halo',-3.1,2.9,2.85,lime,2)
text('Commission title','YOUR IDEA.\nLET\'S MAKE IT.',-.15,4.45,.87)
text('Commission types','MODELS / ANIMATION / VIDEO',-.05,1.9,.235,dim,bold)
cube('Contact tag',(2.5,-1.1,.96),(5.1,.06,.65),coral)
text('Contact action','TELL ME ABOUT YOUR PROJECT',.1,.83,.23,ink,bold)
beat(set(graphics.objects)-before,781,870,'06 CREATE',.25)

# 29–32s: positive ending and a large address that is easy to remember.
before=set(graphics.objects)
disc('Closing halo',3.7,2.9,2.85,coral,2)
text('Closing title','YOUR NEXT\nMOVE.',-5.15,4.6,1.12)
cube('Closing URL backing',(-2.23,-1.15,1.51),(6,.06,.94),ink)
text('Closing URL','alphaff.gg',-4.75,1.22,.75,cyan,bold)
text('Coming soon','REDEEM CODES / COMING SOON',-5.02,.57,.2,ink,bold)
beat(set(graphics.objects)-before,871,960,'07 YOUR NEXT MOVE',-.25)

for label,(a,b) in zip(['HELLO','FREE MODELS','LEARN','WORLDS','HUD','CREATE','YOUR NEXT MOVE'],shots): scene.timeline_markers.new(label,frame=a)
# Clamp Bezier handles to avoid overshoot in character rotations and camera pushes.
for o in scene.objects:
 for fc in curves(o):
  if fc.data_path not in ['hide_render','location','scale'] or o!=rig:
   for k in fc.keyframe_points:
    if k.interpolation=='BEZIER': k.handle_left_type='AUTO_CLAMPED'; k.handle_right_type='AUTO_CLAMPED'
scene['Version']='V2 / Bright studio / 32 seconds / silent review'
scene['Audio']='Voiceover and music pending. No audio added.'
scene['Source imagery']='Actual website product artwork; map images are animated showcase planes, not imported 3D map geometry.'
scene.frame_set(40)
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D': area.spaces.active.region_3d.view_perspective='CAMERA'
# Remove unused, unlinked legacy image nodes in the imported source models.
import os
missing={i for i in bpy.data.images if i.source=='FILE' and not i.packed_file and not os.path.exists(bpy.path.abspath(i.filepath))}
for o in models.objects:
 if o.type=='MESH':
  for m in o.data.materials:
   if m and m.use_nodes:
    for n in list(m.node_tree.nodes):
     if n.type=='TEX_IMAGE' and n.image in missing and not any(p.is_linked for p in n.outputs): m.node_tree.nodes.remove(n)
for i in missing:
 if i.users==0: bpy.data.images.remove(i)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ALPHA-website-intro-v2.blend'))
print('V2 BUILT',len(scene.objects),'objects; 960 frames')
