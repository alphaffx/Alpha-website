import bpy, math, ast
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(r'D:\Alpha website'); OUT=ROOT/'video-intro'
scene=bpy.data.scenes['ALPHA | Website Introduction']; bpy.context.window.scene=scene
rig=bpy.data.objects['ALPHA | Mixamo presenter']
tree=ast.parse((OUT/'build_intro.py').read_text(encoding='utf-8'))
for node in tree.body:
    if isinstance(node,ast.FunctionDef) and node.name in ['aim','pose']:
        exec(compile(ast.Module(body=[node],type_ignores=[]),'pose-functions','exec'))
    if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='poses' for t in node.targets):
        exec(compile(ast.Module(body=[node],type_ignores=[]),'poses','exec'))
for f,k,v in poses: pose(f,k,v)
for m in bpy.data.materials:
    if m.name.startswith('Brand |'):
        p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        e=m.node_tree.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value=p.inputs['Base Color'].default_value
        out=next(n for n in m.node_tree.nodes if n.type=='OUTPUT_MATERIAL')
        m.node_tree.links.new(e.outputs[0],out.inputs['Surface'])
    elif m.name.endswith(' | image'):
        ns=m.node_tree.nodes; out=next(n for n in ns if n.type=='OUTPUT_MATERIAL'); tex=next(n for n in ns if n.type=='TEX_IMAGE')
        e=ns.new('ShaderNodeEmission'); transparent=ns.new('ShaderNodeBsdfTransparent'); mix=ns.new('ShaderNodeMixShader')
        m.node_tree.links.new(tex.outputs['Color'],e.inputs['Color']); m.node_tree.links.new(tex.outputs['Alpha'],mix.inputs[0])
        m.node_tree.links.new(transparent.outputs[0],mix.inputs[1]); m.node_tree.links.new(e.outputs[0],mix.inputs[2]); m.node_tree.links.new(mix.outputs[0],out.inputs['Surface'])
for o in scene.objects:
    if o.type=='FONT' and o.name.endswith(' | title'): o.data.size=.7 if o.name.startswith('01') else .65
    if o.type=='MESH' and o.name.startswith('Map | '):
        im=next(n for n in o.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE').image
        ratio=im.size[1]/im.size[0]; w=min(1.88,1.2/ratio); o.scale=(w/2,w*ratio/2,1)
o=bpy.data.objects['Website ALPHA | Original download showcase']
o.location.z=.7
for layer in o.animation_data.action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:
                if fc.data_path=='scale':
                    for k in fc.keyframe_points:
                        if k.co.y>.001: k.co.y*=2.1/1.7
d=bpy.data.lights.new('Showcase softbox','AREA'); d.energy=250; d.size=4
o=bpy.data.objects.new('Showcase softbox',d); scene.collection.objects.link(o); o.location=(3,-4,4)
o.rotation_euler=(Vector((3.5,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.data.objects['Presenter label'].location.z=.28
scene.frame_set(210)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ALPHA-website-intro.blend'))
print('Refined titles, flat brand colors, image materials, fingers, and showcase lighting.')
