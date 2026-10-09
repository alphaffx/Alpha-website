"""Run in the connected Blender. Creates a separate editable ALPHA intro scene."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(r'D:\Alpha website')
OUT = ROOT / 'video-intro'
OUT.mkdir(exist_ok=True)
SOURCE = bpy.context.scene
assert 'ALPHA | Website Introduction' not in bpy.data.scenes, 'Intro already exists; edit it instead of rebuilding.'
source_rig = next(o for o in SOURCE.objects if o.type == 'ARMATURE')
scene = bpy.data.scenes.new('ALPHA | Website Introduction')
bpy.context.window.scene = scene
scene.render.engine = SOURCE.render.engine
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 1350
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT / 'frames' / 'alpha_')
scene.world = bpy.data.worlds.new('ALPHA | Midnight world')
scene.world.use_nodes = True
bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (.035, .05, .075, 1)
bg.inputs['Strength'].default_value = .35

def collection(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c
stage = collection('01 | Stage and lighting')
people = collection('02 | Mixamo presenter')
graphics = collection('03 | Editable titles and chapters')
showcase = collection('04 | Website ALPHA source model')

def move_to(o, c):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o)
    return o

def linear_color(hexcode):
    rgb = [int(hexcode[i:i+2], 16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)

def mat(name, hexcode, emission=False, metal=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    color=linear_color(hexcode); p.inputs['Base Color'].default_value=color
    p.inputs['Roughness'].default_value=.42; p.inputs['Metallic'].default_value=metal
    if emission:
        e=m.node_tree.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value=color
        output=next(n for n in m.node_tree.nodes if n.type=='OUTPUT_MATERIAL')
        m.node_tree.links.new(e.outputs[0],output.inputs['Surface'])
    return m
dark=mat('Brand | #07090c', '07090c', True)
surface=mat('Brand | #131a22', '131a22', True)
cyan=mat('Brand | #22e8ff', '22e8ff', True)
white=mat('Brand | #e8eef5', 'e8eef5', True)
dim=mat('Brand | #93a4b6', '93a4b6', True)
metal=mat('Stage | Graphite', '18232e', False, .65)

def box(name, loc, size, material, coll=stage, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=move_to(bpy.context.object,coll); o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        b=o.modifiers.new('Soft edges','BEVEL'); b.width=bevel; b.segments=4
    return o

font_path=Path(r'C:\Windows\Fonts\impact.ttf')
display=bpy.data.fonts.load(str(font_path)) if font_path.exists() else None
body=bpy.data.fonts.load(r'C:\Windows\Fonts\arial.ttf')
bold=bpy.data.fonts.load(r'C:\Windows\Fonts\arialbd.ttf')

def text(name, content, x, z, size=.25, material=white, font=None, y=-.35):
    data=bpy.data.curves.new(name,'FONT'); data.body=content; data.size=size
    data.space_line=1.1; data.font=font or body; data.extrude=0
    o=bpy.data.objects.new(name,data); graphics.objects.link(o)
    o.location=(x,y,z); o.rotation_euler=(math.pi/2,0,0); data.materials.append(material)
    return o

def artwork(name, path, x, z, width, height=None, y=-.29):
    im=bpy.data.images.load(str(ROOT/path),check_existing=True)
    ratio=im.size[1]/im.size[0]
    if height: width=min(width,height/ratio)
    height=width*ratio
    m=bpy.data.materials.new(name+' | image'); m.use_nodes=True
    n=m.node_tree.nodes; n.clear(); out=n.new('ShaderNodeOutputMaterial')
    p=n.new('ShaderNodeBsdfPrincipled'); t=n.new('ShaderNodeTexImage'); t.image=im
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value=1
    m.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha'])
    m.node_tree.links.new(p.outputs['BSDF'],out.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=2,location=(x,y,z),rotation=(math.pi/2,0,0))
    o=move_to(bpy.context.object,graphics); o.name=name; o.scale=(width/2,height/2,1); o.data.materials.append(m)
    return o

box('Backdrop', (0,2,3), (30,.12,18), dark, bevel=0)
box('Feature panel', (1.7,.6,3.02), (6.9,.15,4.85),surface,bevel=.13)
box('Panel cyan edge', (-1.74,.48,3.02), (.025,.025,4.5),cyan,bevel=.01)
box('Floor', (0,0,-.16), (30,30,.2),metal,bevel=0)
for x in [-5.5,-4.7,5.6]: box('Architectural cyan strip', (x,1.5,3),(.018,.02,9),cyan,bevel=0)
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1.18,depth=.18,location=(-3.55,0,.02))
podium=move_to(bpy.context.object,stage); podium.name='Presenter podium'; podium.data.materials.append(metal)
for z in [.115,-.035]:
    bpy.ops.mesh.primitive_torus_add(major_radius=1.15,minor_radius=.017,location=(-3.55,0,z))
    o=move_to(bpy.context.object,stage); o.name='Cyan podium ring'; o.data.materials.append(cyan)

camera_data=bpy.data.cameras.new('Landscape 1920 x 1080'); camera_data.type='ORTHO'; camera_data.ortho_scale=12
camera=bpy.data.objects.new('CAM | Website intro',camera_data); stage.objects.link(camera)
camera.location=(0,-18,3.05); camera.rotation_euler=(math.pi/2,0,0); scene.camera=camera
def light(name, loc, power, color, size):
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
    o=bpy.data.objects.new(name,d); stage.objects.link(o); o.location=loc
    o.rotation_euler=(Vector((-3.5,0,2.5))-o.location).to_track_quat('-Z','Y').to_euler()
light('Key softbox',(-5,-5,6),650,(.84,.92,1),5)
light('Cyan rim',(-2,2,4.5),800,(.08,.8,1),3)
light('Front fill',(-1,-3,2),170,(1,.9,.8),3)

artwork('Chrome ALPHA wordmark',Path('media/branding/alpha-chrome-transparent.png'),-4.45,5.75,2.1)
text('Header | 3D SPACE','3D SPACE',-3.15,5.65,.23,cyan,bold)
text('Header | domain','alphaff.gg',3.76,5.65,.26,white,bold)
text('Presenter label','ALPHA / CREATOR',-4.57,.42,.19,dim,bold,y=-1.1)
text('Footer','MODELS  /  LEARN  /  CREATE',-1.35,.25,.18,dim,bold)
box('Progress track',(1.7,-.2,.07),(6.1,.016,.018),dim,graphics,0)
progress=box('Progress | 45 seconds',(-1.35,-.23,.07),(6.1,.018,.028),cyan,graphics,0)
for v in progress.data.vertices: v.co.x+=3.05
progress.scale.x=.001; progress.keyframe_insert('scale',frame=1)
progress.scale.x=1; progress.keyframe_insert('scale',frame=1350)

# Copy the rig and child mesh into the new scene, leaving the source scene intact.
rig=source_rig.copy(); rig.data=source_rig.data.copy(); rig.animation_data_clear(); people.objects.link(rig)
rig.name='ALPHA | Mixamo presenter'; rig.scale=tuple(s*3.8 for s in source_rig.scale); rig.location=(-3.55,0,.13)
for old in source_rig.children_recursive:
    if old.type!='MESH': continue
    o=old.copy(); o.data=old.data.copy(); o.animation_data_clear(); people.objects.link(o)
    o.name='ALPHA | Presenter mesh'; o.parent=rig
    for mod in o.modifiers:
        if mod.type=='ARMATURE': mod.object=rig
for b in rig.pose.bones:
    b.rotation_mode='QUATERNION'; b.matrix_basis=Matrix.Identity(4)

# Pose arm chains in world space while retaining their rest roll.
def aim(name, direction):
    p=rig.pose.bones['mixamorig:'+name]
    bpy.context.view_layer.update()
    desired=rig.matrix_world.to_3x3().inverted() @ Vector(direction)
    m=p.matrix.copy(); q=m.to_3x3().col[1].normalized().rotation_difference(desired.normalized())
    rotation=q.to_matrix() @ m.to_3x3(); result=rotation.to_4x4(); result.translation=m.translation
    p.matrix=result; bpy.context.view_layer.update()

def pose(frame, kind='rest', variation=0):
    scene.frame_set(frame)
    for b in rig.pose.bones: b.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    left=[(.28,-.08,-1),(.06,-.27,-1),(.05,-.18,-1)]
    right=[(-.28,-.08,-1),(-.06,-.27,-1),(-.05,-.18,-1)]
    if kind=='wave': right=[(-.72,-.08,.5),(-.08+variation,-.2,1),(.06+variation,-.05,1)]
    if kind=='present': left=[(.7,-.2,-.5),(.92,-.3,.4),(1,-.12,.28)]
    if kind=='point': left=[(.9,-.1,-.2),(1,-.12,.22),(1,-.08,.17)]
    if kind=='open':
        left=[(.6,-.15,-.6),(.7,-.5,.35),(.8,-.4,.2)]
        right=[(-.6,-.15,-.6),(-.7,-.5,.35),(-.8,-.4,.2)]
    for side,dirs in [('Left',left),('Right',right)]:
        for part,d in zip(['Arm','ForeArm','Hand'],dirs): aim(side+part,d)
        for finger in ['Index','Middle','Ring','Pinky']:
            for j in [1,2,3]:
                p=rig.pose.bones.get('mixamorig:'+side+'Hand'+finger+str(j))
                if p:
                    curl=.1
                    if kind=='point' and side=='Left': curl=0 if finger=='Index' else .85
                    p.rotation_quaternion=Quaternion((1,0,0),curl)
        if kind=='point' and side=='Left':
            for j in [1,2,3]: aim('LeftHandIndex'+str(j),(1,-.08,.17))
        if kind=='wave' and side=='Right':
            for finger in ['Index','Middle','Ring','Pinky']:
                for j in [1,2,3]: aim('RightHand'+finger+str(j),(.06+variation,-.05,1))
    head=rig.pose.bones['mixamorig:Head']
    head.rotation_quaternion=Quaternion((0,0,1),math.radians(variation*8))
    spine=rig.pose.bones['mixamorig:Spine2']
    spine.rotation_quaternion=Quaternion((0,1,0),math.radians(variation*2))
    for b in rig.pose.bones: b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name)

poses=[(1,'rest',0),(22,'wave',0),(37,'wave',.3),(52,'wave',-.25),(68,'wave',.3),(88,'rest',0),
       (132,'present',0),(180,'point',.1),(245,'point',-.1),(300,'present',.1),(348,'rest',0),
       (389,'open',0),(453,'present',.2),(525,'point',.1),(595,'rest',0),
       (655,'present',.1),(715,'point',-.1),(790,'present',.1),(857,'rest',0),
       (900,'point',.1),(972,'present',-.1),(1018,'rest',0),
       (1058,'open',.1),(1138,'present',-.1),(1195,'rest',0),
       (1240,'point',0),(1290,'open',.1),(1350,'open',0)]
for f,k,v in poses: pose(f,k,v)
rig.animation_data.action.name='ALPHA | Welcome, present, point, invite | 45s'

chapters=[
 (1,150,'01 / WELCOME','YOUR NEXT\n3D PROJECT\nSTARTS HERE.','Free Fire creativity. Powered by ALPHA.'),
 (151,360,'02 / FREE MODELS','MEET YOUR\nNEXT CHARACTER.','Preview in 3D. Download free characters.'),
 (361,630,'03 / LEARN WITH ALPHA','FROM FREE FIRE\nTO BLENDER.','Extract. Texture. Rig. Animate.'),
 (631,870,'04 / MAPS & SCENES','BUILD YOUR\nNEXT WORLD.','Bermuda, Alpine, Old Peak and more.'),
 (871,1020,'05 / CREATOR RESOURCES','MAKE IT\nYOUR SETUP.','ALPHA\'s emulator HUD + sensitivity settings.'),
 (1021,1200,'06 / COMMISSIONS','GOT AN IDEA?\nLET\'S CREATE.','Custom models, animation and short-form video.'),
 (1201,1350,'07 / START EXPLORING','YOUR IDEAS.\nYOUR NEXT MOVE.','Discover ALPHA\'s 3D Space.')]

def animate_group(objects, start, end, name):
    root=bpy.data.objects.new(name,None); graphics.objects.link(root)
    for o in objects: o.parent=root
    for frame,scale,x in [(1,.00001,.2),(max(1,start-1),.00001,.2),(start,1,.18),(start+13,1,0),(end-10,1,0),(end,1,-.06),(end+1,.00001,-.06)]:
        root.scale=(scale,)*3; root.location.x=x
        root.keyframe_insert('scale',frame=frame); root.keyframe_insert('location',frame=frame)
    # Instant visibility cuts, with short eased horizontal arrivals.
    for layer in root.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    if fc.data_path=='scale':
                        for key in fc.keyframe_points: key.interpolation='CONSTANT'
    return root

for index,(start,end,label,title,subtitle) in enumerate(chapters):
    before=set(graphics.objects)
    text(label,label,-1.3,4.94,.19,cyan,bold)
    title_size=.70 if index==0 else .65
    text(label+' | title',title,-1.3,4.13,title_size,white,display)
    subz=2.27 if index==0 else 2.78
    text(label+' | subtitle',subtitle,-1.3,subz,.215,dim)
    if index==0:
        text('Welcome | categories','FREE MODELS    /    CLASSES    /    RESOURCES',-1.3,1.57,.175,cyan,bold)
        text('Welcome | invitation','A space for your next creation.',-1.3,1.03,.25,white)
    elif index==1:
        text('Model formats','BROWSER PREVIEW\n\nGLB + BLENDER FILES\n\nFREE DOWNLOADS',-1.3,2.12,.225,cyan,bold)
        # The website source is a separate showcase model, not a second rig.
        with bpy.data.libraries.load(str(ROOT/'models/alpha.blend'),link=False) as (a,b): b.objects=a.objects
        for obj in b.objects:
            if obj and obj.type=='MESH':
                showcase.objects.link(obj); obj.name='Website ALPHA | Original download showcase'
                obj.location=(3.45,-.3,.70); obj.scale=tuple(s*2.1 for s in obj.scale)
                base_scale=obj.scale.copy()
                for f,visible in [(1,False),(151,True),(360,True),(361,False)]:
                    obj.scale=base_scale if visible else Vector((.00001,)*3); obj.keyframe_insert('scale',frame=f)
                obj.rotation_euler.z=-.25; obj.keyframe_insert('rotation_euler',frame=151)
                obj.rotation_euler.z=.4; obj.keyframe_insert('rotation_euler',frame=360)
                for layer in obj.animation_data.action.layers:
                    for strip in layer.strips:
                        for bag in strip.channelbags:
                            for fc in bag.fcurves:
                                if fc.data_path=='scale':
                                    for key in fc.keyframe_points: key.interpolation='CONSTANT'
    elif index==2:
        artwork('English course',Path('media/store/free-fire-blender-en/1.webp'),-.45,1.67,1.5)
        artwork('French course',Path('media/store/free-fire-blender-fr/1.webp'),1.25,1.67,1.5)
        text('Course options','ENGLISH + FRENCH\n\nFREE INTRODUCTION\nPAID FULL COURSE / PARTS',2.2,2.05,.185,cyan,bold)
    elif index==3:
        for slug,x,label2 in [('bermuda',-.38,'BERMUDA'),('alpine',1.67,'ALPINE'),('old-peak',3.72,'OLD PEAK')]:
            artwork('Map | '+slug,Path('media/store')/slug/'1.webp',x,1.81,1.88,1.2)
            text('Map label | '+slug,label2,x-.9,.98,.18,cyan,bold)
        text('More maps','Also: Football Factory / Social Island / Lone Wolf',-1.3,.69,.16,dim)
    elif index==4:
        artwork('HUD resource',Path('media/store/pro-hud/1.webp'),.1,1.7,2.55,1.55)
        text('HUD detail','PRO HUD\n\nLAYOUT + SENSITIVITY\nEMULATOR SETTINGS',1.78,2.12,.22,cyan,bold)
    elif index==5:
        for i,s in enumerate(['01   CHARACTER ANIMATION','02   CUSTOM MODELS','03   SHORT-FORM VIDEO']):
            text('Service | '+s,s,-1.3,2.12-i*.46,.225,cyan,bold)
        text('Contact prompt','Tell me about your project on the Contact page.',-1.3,.71,.185,dim)
    elif index==6:
        box('CTA button',(1.63,-.18,1.89),(5.85,.06,.7),cyan,graphics,.08)
        text('CTA domain','alphaff.gg',.28,1.7,.5,dark,bold,y=-.24)
        text('Redeem status','REDEEM CODES / COMING SOON',-1.3,1.0,.19,cyan,bold)
    animate_group(set(graphics.objects)-before,start,end,label+' | move chapter')
    scene.timeline_markers.new(label,frame=start)

scene['Read me']='45-second silent draft. 30 fps, 1920x1080. Editable text chapters; Mixamo rotation keys. Source scene retained. Add voiceover later and retime markers/keys together.'
scene['Website source']='Local index.html, style.css, store.json, lessons.json, models/models.json; October 9, 2026.'
scene['Voiceover status']='Not supplied. No lip sync or audio.'
scene.frame_set(210)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ALPHA-website-intro.blend'))
print('BUILT',scene.name,len(scene.objects),'objects',scene.frame_end,'frames')
