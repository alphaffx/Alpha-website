# ALPHA website introduction — first draft

45 seconds • landscape 1920 × 1080 • 30 fps • silent, editable Blender project

The live scene's Mixamo ALPHA is the animated presenter. The website's original `models/alpha.blend` appears separately during the free-models chapter. These are two versions of the same character design; the website source has no armature. The original live scene remains in the project, and an untouched backup is saved alongside it.

## Draft voiceover

| Time | Suggested voiceover | Presenter / visuals |
|---|---|---|
| 0–5s | Welcome to ALPHA's 3D Space. Your next project starts here. | Welcome wave; chrome ALPHA wordmark. |
| 5–12s | Explore free characters, preview them in 3D, and download GLB or Blender files. | Point to the source-model showcase. |
| 12–21s | Start with a free introduction. Then learn extraction, textures, rigging, and animation through English and French courses. | Open-hand presentation; course artwork. |
| 21–29s | Build your next world with maps and scenes, including Bermuda, Alpine, Old Peak, and more. | Point toward map previews. |
| 29–34s | Find creator resources, including my emulator HUD layout and sensitivity settings. | Present the HUD resource. |
| 34–40s | Have an idea? Get in touch for custom models, animation, and short-form video. | Open-hand invitation; services. |
| 40–45s | Bring your ideas to life. Explore alpha eff eff dot gee gee. | Website address and final invitation. |

Read the final line as **alphaff.gg**. All copy and timings are provisional until the final voiceover arrives. Redeem Codes appears only as **COMING SOON**. No prices or rendering-course claims are included. Color Correction is hidden on the current website and is not promoted.

## Editing in Blender

- Open `ALPHA-website-intro.blend`; use the scene **ALPHA | Website Introduction**.
- Spacebar plays the timeline. Numpad 0 shows the landscape camera.
- Chapter markers begin at frames **1, 151, 361, 631, 871, 1021, 1201**.
- Collection **02 | Mixamo presenter** contains the rig and skinned mesh. Its action contains welcome, presenting, pointing, and invitation poses. Finger and arm rotations use standard Mixamo bone names.
- Collection **03 | Editable titles and chapters** contains native Blender text, product-image planes, and chapter parent empties. Edit text in the object's text data or enter Edit Mode. Move a chapter's parent animation and matching presenter keys together when retiming.
- Collection **04 | Website ALPHA source model** contains the original downloadable model, with a gentle turn during the models chapter.
- Textures and fonts are packed into the project. The source scene retains its original animation.
- No voiceover, lip sync, or music has been added. Add the supplied audio in the Video Sequencer or finish the edit in your video editor.

## Rendering / handoff

The saved project is **1920 × 1080, 30 fps, frames 1–1350**, EEVEE, PNG frame sequence output to `video-intro/frames/alpha_`. PNGs allow a final render to resume after interruptions. Combine them with the eventual voiceover in the editor.

`ALPHA-intro-silent-preview.mp4`, when rendered, is a **960 × 540, 15 fps** review proxy. Its timings match the 45-second project. The preview script changes settings and keyframe timing in memory only, without saving over the project.

The website has not been changed or published. Embed the final, approved video once audio and timing are finalized.

Content sources: this repository's `index.html`, `style.css`, `store.json`, `lessons.json`, and `models/models.json`, inspected October 9, 2026. Product imagery comes from the site's existing media folder.
