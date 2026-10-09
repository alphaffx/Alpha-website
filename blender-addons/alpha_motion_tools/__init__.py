"""Alpha Motion Tools. SPDX-License-Identifier: GPL-3.0-or-later."""
import bpy
import json
import math
from mathutils import Matrix, Vector
from mathutils.geometry import interpolate_bezier
from bpy.props import (PointerProperty, IntProperty, FloatProperty, BoolProperty,
                       EnumProperty)


def fcurves(action):
    if not action:
        return []
    if hasattr(action, "layers") and len(action.layers):
        return [fc for layer in action.layers for strip in layer.strips
                if hasattr(strip, "channelbags") for bag in strip.channelbags
                for fc in bag.fcurves]
    return list(getattr(action, "fcurves", []))


def animated_transform(obj):
    ad = obj.animation_data
    if not ad:
        return False
    actions = [ad.action] + [st.action for tr in ad.nla_tracks for st in tr.strips]
    paths = {"location", "rotation_euler", "rotation_quaternion", "scale",
             "delta_location", "delta_rotation_euler", "delta_scale"}
    return any(fc.data_path in paths for act in actions for fc in fcurves(act)) or any(
        fc.data_path in paths for fc in ad.drivers)


def enum_set(obj, prop, preferred):
    items = obj.bl_rna.properties[prop].enum_items
    if preferred in {i.identifier for i in items}:
        setattr(obj, prop, preferred)


def curve_length(obj):
    points = []
    for sp in obj.data.splines:
        if sp.type == 'BEZIER':
            bp = sp.bezier_points
            count = len(bp) if sp.use_cyclic_u else len(bp) - 1
            for i in range(count):
                a, b = bp[i], bp[(i + 1) % len(bp)]
                segment = interpolate_bezier(a.co, a.handle_right, b.handle_left, b.co, 65)
                points.extend(obj.matrix_world @ p for p in segment)
        elif sp.type == 'POLY':
            points = [obj.matrix_world @ Vector(p.co[:3]) for p in sp.points]
            if sp.use_cyclic_u:
                points.append(points[0])
        else:
            raise ValueError("Use a Bezier or Poly path for wheel rotation")
    return sum((b - a).length for a, b in zip(points, points[1:]))


def controller_for(root):
    if not root:
        return None
    if root.get("alpha_path_driver"):
        return root
    if root.parent and root.parent.get("alpha_path_driver"):
        return root.parent
    return None


class AM_Settings(bpy.types.PropertyGroup):
    car: PointerProperty(name="Car root", type=bpy.types.Object)
    path: PointerProperty(name="Path", type=bpy.types.Object,
                          poll=lambda self, o: o.type == 'CURVE')
    ground: PointerProperty(name="Ground mesh", type=bpy.types.Object,
                            poll=lambda self, o: o.type == 'MESH')
    start: IntProperty(name="Start", default=1, min=0)
    end: IntProperty(name="End", default=240, min=1)
    forward: EnumProperty(name="Car faces", description="Current forward direction of the car in world axes",
        items=[('FORWARD_Y', '+Y', ''), ('TRACK_NEGATIVE_Y', '-Y', ''),
               ('FORWARD_X', '+X', ''), ('TRACK_NEGATIVE_X', '-X', '')])
    clearance: FloatProperty(name="Origin height", default=0, subtype='DISTANCE',
                             description="Car origin height above the curve")
    brake: BoolProperty(name="Ease into stop", default=True)
    radius: FloatProperty(name="Wheel radius", default=.15, min=.0001, subtype='DISTANCE')
    axle: EnumProperty(name="Local axle", items=[('0','X',''),('1','Y',''),('2','Z','')])
    reverse_spin: BoolProperty(name="Reverse spin", default=False)


RENDER_FIELDS = {
    'render': ['engine','resolution_x','resolution_y','resolution_percentage','fps',
               'fps_base','use_motion_blur','motion_blur_shutter','use_persistent_data'],
    'cycles': ['device','samples','use_adaptive_sampling','adaptive_threshold',
               'use_denoising','denoiser','max_bounces','diffuse_bounces','glossy_bounces',
               'transmission_bounces','transparent_max_bounces','volume_bounces','sample_clamp_indirect'],
    'render.image_settings': ['file_format','color_mode','color_depth'],
    'view_settings': ['view_transform','look','exposure','gamma'],
}


def resolve(scene, path):
    obj = scene
    for part in path.split('.'):
        obj = getattr(obj, part)
    return obj


class AM_OT_render(bpy.types.Operator):
    bl_idname = 'alpha_motion.render_preset'
    bl_label = 'Apply Render Preset'
    bl_options = {'REGISTER', 'UNDO'}
    preset: EnumProperty(items=[('FINAL','Your Final Preset',''),
                               ('FAST','Efficient Final',''),('PREVIEW','Quick Preview',''),
                               ('RESTORE','Restore Previous Settings','')])

    def execute(self, context):
        s = context.scene
        if self.preset == 'RESTORE':
            if 'alpha_render_backup' not in s:
                self.report({'WARNING'}, 'No saved settings to restore')
                return {'CANCELLED'}
            for path, props in json.loads(s['alpha_render_backup']).items():
                for prop, value in props.items():
                    setattr(resolve(s, path), prop, value)
            del s['alpha_render_backup']
            return {'FINISHED'}
        if 'alpha_render_backup' not in s:
            s['alpha_render_backup'] = json.dumps({path: {p: getattr(resolve(s,path),p)
                for p in props if hasattr(resolve(s,path),p)} for path,props in RENDER_FIELDS.items()})
        try:
            s.render.engine = 'CYCLES'
        except TypeError:
            self.report({'ERROR'}, 'Cycles is unavailable in this Blender build')
            return {'CANCELLED'}
        enum_set(s.cycles, 'device', 'GPU')
        s.render.resolution_x, s.render.resolution_y = 1080, 1920
        s.render.resolution_percentage = 50 if self.preset == 'PREVIEW' else 100
        s.render.fps, s.render.fps_base = 30, 1
        s.render.use_motion_blur = self.preset != 'PREVIEW'
        s.render.motion_blur_shutter = .5
        s.render.use_persistent_data = True
        s.cycles.samples = 32 if self.preset == 'PREVIEW' else 128
        s.cycles.use_adaptive_sampling = True
        s.cycles.adaptive_threshold = .05 if self.preset == 'PREVIEW' else .025
        s.cycles.use_denoising = True
        enum_set(s.cycles, 'denoiser', 'OPENIMAGEDENOISE')
        s.cycles.max_bounces = 12 if self.preset == 'FINAL' else 8
        s.cycles.diffuse_bounces = s.cycles.glossy_bounces = 4
        s.cycles.transmission_bounces = 12 if self.preset == 'FINAL' else 6
        s.cycles.transparent_max_bounces = 8
        s.cycles.volume_bounces = 0
        s.cycles.sample_clamp_indirect = 10
        enum_set(s.render.image_settings, 'file_format', 'PNG')
        enum_set(s.render.image_settings, 'color_mode', 'RGB')
        enum_set(s.render.image_settings, 'color_depth', '16')
        enum_set(s.view_settings, 'view_transform', 'AgX')
        enum_set(s.view_settings, 'look', 'None')
        s.view_settings.exposure, s.view_settings.gamma = 0, 1
        self.report({'INFO'}, 'Preset applied. Output folder, frame range, and GPU preferences preserved.')
        return {'FINISHED'}


class AM_OT_clear(bpy.types.Operator):
    bl_idname = 'alpha_motion.clear_location'
    bl_label = 'Clear Selected Location'
    bl_description = 'Reset selected objects to local zero, like Alt-G; preserves rotation and scale'
    bl_options = {'REGISTER','UNDO'}

    @classmethod
    def poll(cls, context):
        return context.mode == 'OBJECT' and bool(context.selected_editable_objects)

    def execute(self, context):
        animated = 0
        for obj in context.selected_editable_objects:
            obj.location = (0,0,0)
            animated += bool(animated_transform(obj) or obj.constraints)
        if animated:
            self.report({'WARNING'}, 'Cleared local location; animation/constraints may override it on playback')
        return {'FINISHED'}


class AM_OT_pick(bpy.types.Operator):
    bl_idname = 'alpha_motion.use_selection'
    bl_label = 'Use Selection'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        p = context.scene.alpha_motion
        curves_ = [o for o in context.selected_objects if o.type == 'CURVE']
        cars = [o for o in context.selected_objects if o.type != 'CURVE']
        if len(curves_) != 1 or len(cars) != 1:
            self.report({'ERROR'}, 'Select exactly one car root and one curve')
            return {'CANCELLED'}
        p.car, p.path = cars[0], curves_[0]
        return {'FINISHED'}


class AM_OT_path(bpy.types.Operator):
    bl_idname = 'alpha_motion.setup_path'
    bl_label = 'Create Car Path Rig'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        p = context.scene.alpha_motion
        car, path = p.car, p.path
        if not car or not path or car == path or p.end <= p.start:
            self.report({'ERROR'}, 'Choose a car, a curve, and an end frame after start')
            return {'CANCELLED'}
        if controller_for(car) or car.constraints or animated_transform(car):
            self.report({'ERROR'}, 'Root already has constraints/transform animation. Use a clean parent Empty.')
            return {'CANCELLED'}
        if path in car.children_recursive or len(path.data.splines) != 1:
            self.report({'ERROR'}, 'Use one continuous curve outside the car hierarchy')
            return {'CANCELLED'}
        if (any(abs(v) > 1e-6 for v in car.delta_location) or
                any(abs(v)>1e-6 for v in car.delta_rotation_euler) or
                abs(car.delta_rotation_quaternion.angle)>1e-6 or
                any(abs(v-1)>1e-6 for v in car.delta_scale)):
            self.report({'ERROR'}, 'Clear or apply delta transforms on the car root first')
            return {'CANCELLED'}
        original = car.matrix_world.copy()
        ctrl = bpy.data.objects.new(car.name + ' - Path Driver', None)
        context.scene.collection.objects.link(ctrl)
        ctrl['alpha_path_driver'] = True
        ctrl['alpha_car'] = car.name
        ctrl['alpha_original_parent'] = car.parent.name if car.parent else ''
        ctrl['alpha_original_world'] = json.dumps([list(r) for r in original])
        ctrl['alpha_start'], ctrl['alpha_end'] = p.start, p.end
        con = ctrl.constraints.new('FOLLOW_PATH')
        con.name = 'Alpha Drive'
        con.target = path
        con.use_fixed_location = con.use_curve_follow = True
        enum_set(con, 'forward_axis', p.forward)
        enum_set(con, 'up_axis', 'UP_Z')
        path.data.use_path = True
        path.data.resolution_u = max(path.data.resolution_u, 24)
        for frame,value in [(p.start,0),(p.end,1)]:
            con.offset_factor = value
            con.keyframe_insert(data_path='offset_factor', frame=frame)
        for fc in fcurves(ctrl.animation_data.action):
            for k in fc.keyframe_points:
                enum_set(k,'interpolation','LINEAR')
            if p.brake:
                start,end = fc.keyframe_points
                duration = p.end-p.start
                for k in (start,end):
                    enum_set(k,'interpolation','BEZIER')
                    enum_set(k,'handle_left_type','FREE')
                    enum_set(k,'handle_right_type','FREE')
                # Monotonic cubic: initial movement, then gradually ease to zero speed.
                start.handle_right = (p.start+duration/3, .5)
                end.handle_left = (p.end-duration/3, 1)
        car.parent = ctrl
        car.matrix_parent_inverse = Matrix.Identity(4)
        car.matrix_basis = Matrix.LocRotScale(Vector((0,0,p.clearance)),
                                             original.to_quaternion(), original.to_scale())
        context.scene.frame_set(context.scene.frame_current)
        self.report({'INFO'}, 'Path rig created. Use Ctrl-Z or Restore Car Placement to undo setup.')
        return {'FINISHED'}


class AM_OT_detach(bpy.types.Operator):
    bl_idname = 'alpha_motion.restore_car'
    bl_label = 'Restore Car Placement'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        ctrl = controller_for(context.scene.alpha_motion.car)
        if not ctrl or 'alpha_original_world' not in ctrl:
            return {'CANCELLED'}
        car = bpy.data.objects.get(ctrl.get('alpha_car',''))
        if not car:
            return {'CANCELLED'}
        if any(o != car for o in ctrl.children):
            self.report({'ERROR'}, 'Move additional controller children before restoring')
            return {'CANCELLED'}
        for info in json.loads(ctrl.get('alpha_wheels', '[]')):
            wheel = bpy.data.objects.get(info['name'])
            if wheel:
                wheel.parent = bpy.data.objects.get(info['parent'])
                wheel.parent_type = info['parent_type']
                wheel.parent_bone = info['parent_bone']
                wheel.matrix_parent_inverse = Matrix(info['inverse'])
                wheel.matrix_basis = Matrix(info['basis'])
                if 'alpha_roll' in wheel:
                    del wheel['alpha_roll']
            for name in [info['roll'], info['pivot']]:
                obj = bpy.data.objects.get(name)
                if obj:
                    bpy.data.objects.remove(obj, do_unlink=True)
        car.parent = bpy.data.objects.get(ctrl.get('alpha_original_parent',''))
        car.matrix_world = Matrix(json.loads(ctrl['alpha_original_world']))
        bpy.data.objects.remove(ctrl, do_unlink=True)
        return {'FINISHED'}


class AM_OT_smooth(bpy.types.Operator):
    bl_idname = 'alpha_motion.smooth_path'
    bl_label = 'Smooth Bezier Handles'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        path = context.scene.alpha_motion.path
        if not path:
            return {'CANCELLED'}
        for sp in path.data.splines:
            for p in sp.bezier_points:
                enum_set(p,'handle_left_type','AUTO')
                enum_set(p,'handle_right_type','AUTO')
        path.data.resolution_u = 32
        return {'FINISHED'}


class AM_OT_ground(bpy.types.Operator):
    bl_idname = 'alpha_motion.ground_path'
    bl_label = 'Project Path to Ground'
    bl_description = 'Project Bezier control points down onto the chosen ground; inspect spans on uneven terrain'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        p = context.scene.alpha_motion
        if not p.path or not p.ground:
            self.report({'ERROR'}, 'Choose a path and ground mesh')
            return {'CANCELLED'}
        ground = p.ground.evaluated_get(context.evaluated_depsgraph_get())
        inv = ground.matrix_world.inverted()
        top = max((ground.matrix_world @ Vector(v)).z for v in ground.bound_box) + 1
        count = 0
        for sp in p.path.data.splines:
            for bp in sp.bezier_points:
                world = p.path.matrix_world @ bp.co
                origin = Vector((world.x,world.y,max(top,world.z+1)))
                hit,loc,normal,index = ground.ray_cast(inv @ origin,
                    (inv.to_3x3() @ Vector((0,0,-1))).normalized())
                if hit:
                    target = p.path.matrix_world.inverted() @ (ground.matrix_world @ loc)
                    delta = target-bp.co
                    left,right = bp.handle_left.copy(),bp.handle_right.copy()
                    bp.co = target
                    bp.handle_left, bp.handle_right = left+delta, right+delta
                    count += 1
        self.report({'INFO'}, f'Projected {count} control points; inspect between points on uneven ground')
        return {'FINISHED'}


class AM_OT_wheels(bpy.types.Operator):
    bl_idname = 'alpha_motion.roll_wheels'
    bl_label = 'Add Roll to Selected Wheels'
    bl_description = 'Select wheel-root objects with origins at their axles; radius is in world units'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        p = context.scene.alpha_motion
        ctrl = controller_for(p.car)
        wheels = list(context.selected_editable_objects)
        if not ctrl or not wheels or any(w == p.car or w == ctrl or w == p.path or
                w not in p.car.children_recursive or animated_transform(w) or w.constraints or
                w.get('alpha_roll') for w in wheels):
            self.report({'ERROR'}, 'Select unanimated wheel roots inside the configured car hierarchy')
            return {'CANCELLED'}
        if any(other in w.children_recursive for w in wheels for other in wheels if other != w):
            self.report({'ERROR'}, 'Select wheel roots only, not their children')
            return {'CANCELLED'}
        con = next((c for c in ctrl.constraints if c.type=='FOLLOW_PATH'),None)
        if not con:
            self.report({'ERROR'}, 'Wheel setup requires an unbaked path rig')
            return {'CANCELLED'}
        try:
            length = curve_length(con.target)
        except ValueError as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}
        ctrl['alpha_path_length'] = length
        backups = json.loads(ctrl.get('alpha_wheels','[]'))
        for wheel in wheels:
            # A separate pivot preserves the wheel's original camber and static orientation.
            mat = wheel.matrix_world.copy()
            info = {'name':wheel.name,'parent':wheel.parent.name if wheel.parent else '',
                    'parent_type':wheel.parent_type,'parent_bone':wheel.parent_bone,
                    'inverse':[list(r) for r in wheel.matrix_parent_inverse],
                    'basis':[list(r) for r in wheel.matrix_basis]}
            pivot = bpy.data.objects.new(wheel.name+' - Roll', None)
            context.scene.collection.objects.link(pivot)
            pivot.parent = wheel.parent
            pivot.matrix_world = Matrix.LocRotScale(mat.translation,mat.to_quaternion(),Vector((1,1,1)))
            roll = bpy.data.objects.new(wheel.name+' - Axle',None)
            context.scene.collection.objects.link(roll)
            roll.parent = pivot
            context.view_layer.update()
            wheel.parent = roll
            enum_set(wheel,'parent_type','OBJECT')
            wheel.matrix_world = mat
            drv = roll.driver_add('rotation_euler',int(p.axle)).driver
            for name,path in [('progress',con.path_from_id('offset_factor')),('distance','["alpha_path_length"]')]:
                var = drv.variables.new(); var.name = name
                var.targets[0].id = ctrl; var.targets[0].data_path = path
            drv.expression = f'progress*distance/{p.radius}*{(-1 if p.reverse_spin else 1)}'
            roll.update_tag()
            wheel['alpha_roll'] = True
            info.update(pivot=pivot.name,roll=roll.name)
            backups.append(info)
        ctrl['alpha_wheels'] = json.dumps(backups)
        ctrl.update_tag()
        context.view_layer.update()
        self.report({'INFO'}, 'Wheel roll added. Recalculate path length after editing the curve.')
        return {'FINISHED'}


class AM_OT_length(bpy.types.Operator):
    bl_idname = 'alpha_motion.refresh_length'
    bl_label = 'Recalculate Wheel Travel'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        ctrl = controller_for(context.scene.alpha_motion.car)
        if not ctrl:
            return {'CANCELLED'}
        con = next((c for c in ctrl.constraints if c.type=='FOLLOW_PATH'),None)
        if not con:
            return {'CANCELLED'}
        try:
            ctrl['alpha_path_length'] = curve_length(con.target)
        except ValueError as exc:
            self.report({'ERROR'},str(exc)); return {'CANCELLED'}
        return {'FINISHED'}


class AM_OT_bake(bpy.types.Operator):
    bl_idname = 'alpha_motion.bake_path'
    bl_label = 'Bake Path to Keyframes'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        ctrl = controller_for(context.scene.alpha_motion.car)
        if not ctrl:
            return {'CANCELLED'}
        s = context.scene; saved = s.frame_current
        poses = []
        try:
            for frame in range(ctrl['alpha_start'],ctrl['alpha_end']+1):
                s.frame_set(frame)
                poses.append((frame,ctrl.matrix_world.copy()))
            con = next((c for c in ctrl.constraints if c.type=='FOLLOW_PATH'),None)
            if not con:
                return {'CANCELLED'}
            # Keep animated offset values for existing wheel drivers, but mute spatial influence.
            con.influence = 0
            enum_set(ctrl,'rotation_mode','QUATERNION')
            for frame,mat in poses:
                ctrl.matrix_world = mat
                ctrl.keyframe_insert(data_path='location',frame=frame)
                ctrl.keyframe_insert(data_path='rotation_quaternion',frame=frame)
            for fc in fcurves(ctrl.animation_data.action):
                if fc.data_path in {'location','rotation_quaternion'}:
                    for k in fc.keyframe_points:enum_set(k,'interpolation','LINEAR')
        finally:
            s.frame_set(saved)
        return {'FINISHED'}


class AM_OT_camera(bpy.types.Operator):
    bl_idname = 'alpha_motion.tracking_camera'
    bl_label = 'Create Tracking Camera'
    bl_options = {'REGISTER','UNDO'}

    def execute(self, context):
        car = context.scene.alpha_motion.car or context.active_object
        if not car:
            return {'CANCELLED'}
        data = bpy.data.cameras.new('Alpha Tracking Camera')
        data.lens = 35
        data.clip_start = .01
        cam = bpy.data.objects.new('Alpha Tracking Camera',data)
        context.scene.collection.objects.link(cam)
        cam.parent = car
        cam.location = (6,-8,4)
        cam.rotation_euler = (Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler()
        context.scene.camera = cam
        marker = context.scene.timeline_markers.new('Alpha camera cut',frame=context.scene.frame_current)
        marker.camera = cam
        return {'FINISHED'}


class AM_PT_tools(bpy.types.Panel):
    bl_label = 'Alpha Motion Tools'
    bl_idname = 'AM_PT_tools'
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Alpha Tools'

    def draw(self, context):
        l = self.layout; p = context.scene.alpha_motion
        b = l.box(); b.label(text='Render Presets')
        for ident,label in [('FINAL','Your Final Preset'),('FAST','Efficient Final'),('PREVIEW','Quick Preview'),('RESTORE','Restore Previous Settings')]:
            b.operator('alpha_motion.render_preset',text=label).preset=ident
        l.operator('alpha_motion.clear_location')
        b=l.box(); b.label(text='Car Follows Curve')
        b.operator('alpha_motion.use_selection')
        b.prop(p,'car'); b.prop(p,'path'); b.prop(p,'forward')
        row=b.row(align=True); row.prop(p,'start'); row.prop(p,'end')
        b.prop(p,'clearance'); b.prop(p,'brake')
        b.operator('alpha_motion.setup_path'); b.operator('alpha_motion.restore_car')
        b.operator('alpha_motion.smooth_path')
        b.prop(p,'ground'); b.operator('alpha_motion.ground_path')
        b=l.box(); b.label(text='Wheels (select wheel roots)')
        b.prop(p,'radius'); b.prop(p,'axle'); b.prop(p,'reverse_spin')
        b.operator('alpha_motion.roll_wheels'); b.operator('alpha_motion.refresh_length')
        l.operator('alpha_motion.bake_path'); l.operator('alpha_motion.tracking_camera')


CLASSES=(AM_Settings,AM_OT_render,AM_OT_clear,AM_OT_pick,AM_OT_path,AM_OT_detach,
         AM_OT_smooth,AM_OT_ground,AM_OT_wheels,AM_OT_length,AM_OT_bake,AM_OT_camera,AM_PT_tools)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.alpha_motion=PointerProperty(type=AM_Settings)


def unregister():
    del bpy.types.Scene.alpha_motion
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == '__main__':
    register()
