# Alpha Motion Tools 1.0

An offline Blender extension for quick render setup and car-path animation.
Requires Blender 4.2 or newer. Tested in Blender 5.1.1.

## Install

1. In Blender, open **Edit > Preferences > Get Extensions**.
2. Open the menu at the upper right and choose **Install from Disk**.
3. Choose `alpha_motion_tools-1.0.0.zip` and enable the extension.
4. In the 3D Viewport press **N**, then open **Alpha Tools**.

If a temporary development copy is already loaded in your session, restart Blender
before installing the ZIP. Save your scene first.

## Render presets

| Setting | Your Final Preset | Efficient Final | Quick Preview |
|---|---|---|---|
| Engine | Cycles GPU | Cycles GPU | Cycles GPU |
| Resolution | 1080 x 1920 | 1080 x 1920 | 540 x 960 |
| Frame rate | 30 | 30 | 30 |
| Max samples | 128 | 128 | 32 |
| Adaptive threshold | 0.025 | 0.025 | 0.05 |
| Denoising | OpenImageDenoise | OpenImageDenoise | OpenImageDenoise |
| Total / transmission bounces | 12 / 12 | 8 / 6 | 8 / 6 |
| Motion blur | On, shutter 0.5 | On, shutter 0.5 | Off |

All presets use AgX, PNG RGB 16-bit output, persistent data, diffuse/glossy bounces
4, transparent bounces 8, volume bounces 0, and indirect clamp 10. These presets are
designed for this non-volumetric scene; increase volume bounces for fog or smoke.
Choose your OptiX GPU in Blender's system preferences; the extension does not change
hardware preferences. The output directory, scene frame range, lighting, and camera
remain unchanged. Applying a preset never starts a render.

**Restore Previous Settings** restores the settings from before the first preset
applied since the last restore. This backup is stored in the scene.

## Clear location

**Clear Selected Location** zeros the local location of selected editable objects,
like Alt-G. It preserves rotation, scale, parenting, constraints, and keyframes.
For parented objects, local zero is the parent's origin, not necessarily world zero.
Existing animation or constraints can override this change during playback; the
button warns when that may happen. Normal Blender Undo is supported.

## Car along a curve

1. Put all car parts under one root object or Empty. Choose a clean, unanimated root.
2. Select that root and one curve, then click **Use Selection**, or use the eyedroppers.
3. Set **Car faces** to the car's forward direction in world axes before setup.
4. Choose the start/end frames and origin height above the path.
5. Click **Create Car Path Rig**. The car's origin moves to the path; model orientation
   and scale are retained relative to the generated controller.
6. Turn **Ease into stop** off for constant progress, or on for a gradual stop.

The root cannot already have transform keyframes, drivers, or constraints. Child
armature/pose animation is fine. A clean parent Empty avoids competing animations.
Use one continuous spline. Ground should be approximately horizontal; this is not a
terrain suspension or vehicle physics system.

**Restore Car Placement** returns the car and any wheel-roll helpers created by this
tool to their original setup. **Bake Path to Keyframes** samples the controller once
per frame and mutes the spatial path influence. Wheel progress drivers are retained.
Curve edits no longer change the baked movement. Bake short ranges first on large scenes.

## Curve and wheels

- **Smooth Bezier Handles** changes the path's handles to automatic. This can change
  its shape, so inspect the resulting turn.
- **Project Path to Ground** casts down to the chosen ground mesh and moves Bezier
  control points and handles. It does not subdivide or continuously conform every
  span; inspect contact between points on uneven terrain.
- Select wheel-root objects already inside the car hierarchy. Each origin must sit
  at its axle. Choose a wheel radius in world units and the local axle axis, then
  **Add Roll to Selected Wheels**. Use **Reverse spin** for the opposite direction.
- Use separate operations for front/rear wheels with different radii. Wheels should
  not have existing transform animation or constraints. Bone parenting is preserved
  when restoring, but an independently moving bone needs a bespoke vehicle rig.
- **Recalculate Wheel Travel** updates wheel travel after curve edits. Wheel rotation
  approximates distance along the centre path, not each tire's individual turning arc.
- This version does not automatically steer front wheels, add drift, or simulate suspension.

## Camera helper

**Create Tracking Camera** makes a camera parented to the configured car (or the active
object), sets it as the scene camera, and adds a cut at the current frame. Its initial
position assumes a roughly car-sized model. Adjust the camera for your model, facing
direction, scene scale, and output aspect ratio. The camera is designed to follow the
car as a rigid chase camera.

## Suggested next additions

Useful future features: front-wheel steering with adjustable wheelbase; drift controls;
door-hinge helpers; character visibility swaps; camera-cut management; scene performance
checks. These are not included in version 1.0.

## Validation

An isolated temporary scene in Blender 5.1.1 verified path endpoints, wheel rest
orientation/spin, baked movement, restoration of the car/wheel hierarchy, local
location clearing, all presets and settings restoration, ground projection,
curve smoothing, and camera creation. No existing scene objects were used in tests.

License: GPL-3.0-or-later.
