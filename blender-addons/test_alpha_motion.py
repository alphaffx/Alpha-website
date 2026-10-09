"""Run in Blender after enabling Alpha Motion Tools. Uses a temporary scene."""
import bpy
import traceback
from mathutils import Vector

original = bpy.context.window.scene
tracked = [bpy.data.objects, bpy.data.actions, bpy.data.meshes, bpy.data.curves, bpy.data.cameras]
before = [set(group) for group in tracked]
scene = bpy.data.scenes.new('Alpha Tools - test scene')
passed = []
try:
    bpy.context.window.scene = scene
    car = bpy.data.objects.new('Test car', None)
    scene.collection.objects.link(car)
    car.location = (4,5,0)
    data = bpy.data.curves.new('Test path', 'CURVE')
    data.dimensions = '3D'
    sp = data.splines.new('BEZIER'); sp.bezier_points.add(1)
    for b,v in zip(sp.bezier_points, [(0,0,0),(0,10,0)]):
        b.co=v; b.handle_left_type='VECTOR'; b.handle_right_type='VECTOR'
    path = bpy.data.objects.new('Test path',data); scene.collection.objects.link(path)
    p=scene.alpha_motion; p.car=car; p.path=path; p.start=1; p.end=21
    assert bpy.ops.alpha_motion.setup_path()=={'FINISHED'}
    ctrl=car.parent
    scene.frame_set(1); assert car.matrix_world.translation.length<.001
    scene.frame_set(21); assert (car.matrix_world.translation-Vector((0,10,0))).length<.01
    passed.append('path endpoints')
    scene.frame_set(1)
    wheel=bpy.data.objects.new('Test wheel',None); scene.collection.objects.link(wheel)
    wheel.parent=car; wheel.location=(.5,0,.3); wheel.rotation_euler=(0,.2,.1)
    bpy.context.view_layer.update(); rest=wheel.matrix_world.copy()
    wheel.select_set(True); bpy.context.view_layer.objects.active=wheel
    assert bpy.ops.alpha_motion.roll_wheels()=={'FINISHED'}
    bpy.context.view_layer.update()
    assert max(abs(wheel.matrix_world[i][j]-rest[i][j]) for i in range(4) for j in range(4))<.001
    scene.frame_set(11); bpy.context.view_layer.update()
    assert abs(wheel.parent.rotation_euler.x)>1, 'wheel driver did not evaluate'
    passed.append('wheel rest orientation and spin')
    position=ctrl.matrix_world.copy()
    assert bpy.ops.alpha_motion.bake_path()=={'FINISHED'}
    scene.frame_set(11); bpy.context.view_layer.update()
    assert max(abs(ctrl.matrix_world[i][j]-position[i][j]) for i in range(4) for j in range(4))<.001
    assert abs(wheel.parent.rotation_euler.x)>1
    passed.append('bake preserves pose and wheel driver')
    assert bpy.ops.alpha_motion.restore_car()=={'FINISHED'}
    bpy.context.view_layer.update()
    assert car.parent is None and (car.location-Vector((4,5,0))).length<.001
    assert wheel.parent==car and abs(wheel.rotation_euler.y-.2)<.001
    passed.append('restore car and wheel hierarchy')
    wheel.select_set(False); car.select_set(True); bpy.context.view_layer.objects.active=car
    assert bpy.ops.alpha_motion.clear_location()=={'FINISHED'}
    assert car.location.length<.001
    passed.append('clear local location')
    old=(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.cycles.samples)
    assert bpy.ops.alpha_motion.render_preset(preset='FINAL')=={'FINISHED'}
    assert (scene.render.resolution_x,scene.render.resolution_y,scene.cycles.samples)==(1080,1920,128)
    assert bpy.ops.alpha_motion.render_preset(preset='PREVIEW')=={'FINISHED'}
    assert scene.render.resolution_percentage==50 and scene.cycles.samples==32
    assert bpy.ops.alpha_motion.render_preset(preset='FAST')=={'FINISHED'}
    assert scene.cycles.max_bounces==8 and scene.cycles.transmission_bounces==6
    assert bpy.ops.alpha_motion.render_preset(preset='RESTORE')=={'FINISHED'}
    assert old==(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.cycles.samples)
    passed.append('all render presets and restoration')
    mesh=bpy.data.meshes.new('Test ground'); mesh.from_pydata([(-20,-20,-2),(20,-20,-2),(20,20,-2),(-20,20,-2)],[],[(0,1,2,3)])
    ground=bpy.data.objects.new('Test ground',mesh); scene.collection.objects.link(ground)
    p.ground=ground
    assert bpy.ops.alpha_motion.ground_path()=={'FINISHED'}
    assert all(abs(b.co.z+2)<.001 for b in sp.bezier_points)
    assert bpy.ops.alpha_motion.smooth_path()=={'FINISHED'}
    passed.append('ground projection and smoothing')
    assert bpy.ops.alpha_motion.tracking_camera()=={'FINISHED'}
    assert scene.camera.parent==car
    passed.append('tracking camera and cut marker')
    print('PASS:',passed)
except Exception:
    print('FAILED after',passed)
    print(traceback.format_exc())
finally:
    bpy.context.window.scene=original
    for obj in set(bpy.data.objects)-before[0]: bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.scenes.remove(scene)
    for group,previous in zip(tracked[1:],before[1:]):
        for obj in set(group)-previous:
            if obj.users==0: group.remove(obj)
    print('Original scene restored:',original.name)
