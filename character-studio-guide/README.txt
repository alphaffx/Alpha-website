ALPHA CHARACTER STUDIO - USER GUIDE
Windows | Version 1.4.6

Online guide: https://alphaff.gg/character-studio-guide/
Support: admin@alphaff.gg

The included User Guide.html opens in your browser and can be printed.

START HERE
----------
ALPHA Character Studio lets you choose a Free Fire character, change their outfit, preview animations and prepare assets for Blender. You can also browse pets, weapons, vehicles and other available items.

Your first project: install Studio → build your library → choose a character → equip an outfit → choose an animation → prepare it for Blender.

The installer does not include game resources. Studio builds a local library from the Free Fire or Free Fire MAX resources already downloaded in your Android emulator. What you can use depends on the resources available in that installation.

BEFORE YOU INSTALL
------------------
- A Windows 64-bit PC.
- Free Fire or Free Fire MAX installed in an Android emulator, with the resources you want fully downloaded. The setup page looks for BlueStacks, MSI App Player, LDPlayer, MEmu and Nox; a detected installation still needs compatible, readable resources.
- Allow at least 20 GB of free space while building a library. The setup screen shows an estimate for your selected installation. A finished library is typically around 3–4 GB, but sizes vary.
- Blender installed if you want to import into Blender.
- Internet to download the installer, download game resources in the emulator, check app updates and view online catalog pictures. After setup, local models, local textures and Blender exports work on your PC.

You do not need to install Python or Node.js separately. They are included with the installer.

1. INSTALL AND OPEN STUDIO
--------------------------
1. Download ALPHA-Character-Studio-Setup.exe from your ALPHA purchase on Gumroad.
2. Run the installer and follow the setup steps. It installs for your Windows user; it does not normally need an administrator prompt.
3. Keep the Blender add-ons option selected if you want the installer to copy the ALPHA add-ons into a detected Blender installation. You can also choose a desktop shortcut.
4. Open ALPHA Character Studio from the Start menu or desktop shortcut. It opens in its own app window. Opening the launcher again brings the existing window forward.

If you use the portable ZIP instead, extract the entire ZIP into a writable folder and open Open Studio.vbs. Keep its folders together; do not run it from inside the ZIP.

2. BUILD YOUR RESOURCE LIBRARY
------------------------------
1. Open your emulator and finish downloading the game resources you want to use.
2. Close the emulator before building the library.
3. Open Studio. On Set up your library, choose the emulator installation that contains your downloaded resources. Use Look again if needed.
4. Choose a library folder on a drive with enough free space, for example D:\ALPHA Library. Keep it outside the Studio installation folder.
5. Click Build my library. Keep the app open and let the progress screen finish. A build can take around 45 minutes; your disk, PC and resources affect the time.
6. When the build finishes, click Open Character Studio.

Already built a library? Open I already have a library folder, select the folder containing index and previews, then click Open it. Do not select an OBB file or an unpacked-resource folder.

The library stays separate from the app. Keep a backup of your saved project files and your library before moving to another PC. Updating the app does not automatically download new game resources.

3. CHOOSE AND DRESS A CHARACTER
-------------------------------
1. Open Choose character and search for the character by name.
2. Choose an available character and wait for its 3D preview to load.
3. Open Browse outfits. Search by name and use the part icons to filter hair, masks, face paint, tops, pants, shoes, accessories or backpacks.
4. Select an item to inspect it, then use its equip control. Click Equip or Put on, depending on the section. Where the same button changes to Unequip, click it again to remove the item.
5. Equipping another item in the same slot replaces that slot. Check the fit in the character preview. You can review your outfit under Equipped pieces.

Preview controls: drag to rotate and scroll to zoom. Open Preview controls for Front, Back, Fit and Wireframe. Full character shows the assembled outfit; Single item inspects the selected piece.

Selecting a clothing category smoothly focuses the preview on that part. Use Full character above the preview to see the whole outfit again. You can turn Smooth zoom off under Preview controls. Face paint changes the original face texture; styles without a verified local texture stay unavailable.

A catalog picture does not guarantee a usable 3D model. Items marked missing or unavailable need additional matching resources. Different body types and outfits may need fit adjustments in Blender.

4. ADD AN ANIMATION OR EMOTE
----------------------------
1. Choose your character first.
2. Open Emotes or Gameplay, search for a motion and select it.
3. Use the playback controls to play, pause and scrub through the animation. Use Game camera when that option is available for the selected emote.
4. Check the character, clothing and any props throughout the motion before exporting.

The preview playback-speed control changes how you view the animation. Exported clips keep their original timing.

Some effects, props, camera moves or particle effects may be missing or may not reproduce exactly in Blender. Read any availability warnings; a preview is not a promise that every game effect can be exported.

5. PETS, WEAPONS, VEHICLES AND OTHER ITEMS
------------------------------------------
- Pets: choose a pet in Pets, select an available skin and animation, then use Equip to add it to your character scene. Use Unequip to remove it. Prepare pet for Blender prepares a separate pet export.
- Weapons: select an available weapon and use its equip control to attach it to the character. Inspect the pose and attachment before export.
- Vehicles and items: select an available asset, inspect its preview and use the Blender preparation control in that section.

Unavailable alternate skins stay marked unavailable. Studio does not substitute an unrelated skin to make a missing item look ready.

A saved character project includes supported character equipment and animation settings. Separate vehicle and item previews are exported separately.

6. SAVE YOUR WORK
-----------------
1. Open Project in the top bar.
2. Enter a project name and click Save project.
3. Keep the downloaded .alpha.json file somewhere you can find it.
4. To return to it, open Project → Open project and select that file.

Project files store references and settings, not the models and textures themselves. They need the matching resource library. Keep both when transferring a project to another PC.

Outfit-only files from earlier versions are under Project → Outfit files (legacy).

7. CHOOSE YOUR EXPORT RIG
-------------------------
Use Character export above the preview before preparing a character for Blender.

 | Option | What it exports | Use it for

 | Mesh only | Outfit meshes and embedded textures in the rest pose, without bones or animation. | Static models, posing with your own rig, or manual rigging.

 | Free Fire rig | The available original game skeleton, skin weights and selected supported animation. | Keeping the source character rig and motion.

Fortnite rig export is temporarily unavailable while its skeleton is repaired. Use the original Free Fire rig or Mesh only.

8. IMPORT INTO THE BLENDER SCENE YOU CHOOSE
-------------------------------------------
Enable the ALPHA Studio Link add-on

1. In Blender, open Edit → Preferences → Add-ons and enable ALPHA Studio Link if the installer already copied it.
2. If it is missing, use Install from Disk to install the individual ALPHA-Studio-Link-VERSION.zip from the app folder or your Gumroad download. Keep it zipped; the material helper is included. For optional car controls, also install ALPHA-Vehicle-Tools-VERSION.zip. If Blender says "No module named", remove the broken entry, restart Blender, then install these ZIPs without renaming them. Do not install the outer add-on bundle ZIP.
3. Set the add-on’s Inbox folder to YOUR_LIBRARY_FOLDER\exports\to-blender. Replace YOUR_LIBRARY_FOLDER with the library folder you chose during setup.

With Studio open, click Connect to Studio in Blender's ALPHA panel to select the correct export folder automatically. Import and Apply animation also connect to the running Studio. This avoids old paths from another PC. If Studio is closed or uses a custom port, set Inbox folder manually to your library's exports\to-blender folder.

Prepare, then import

1. In Studio, choose your outfit, motion and export rig, then click Prepare for Blender. Wait for preparation to finish.
2. Switch to the Blender project and scene where you want the asset.
3. Place Blender’s 3D cursor where you want the imported asset to start.
4. In the 3D View, press N to open the sidebar, open ALPHA, then click Import into this scene.

Preparing is not importing. Studio stages the export; you decide which Blender scene receives it. It does not automatically import into every open Blender project.

Imports face +X with Z up. The ground control starts at the 3D cursor. Select that control to move, rotate or scale the complete asset.

Using ALPHA Studio Link reconstructs supported custom character material nodes. Download GLB is an alternative for saving a portable file and importing it manually, but a generic GLB import uses portable PBR materials rather than the add-on’s custom game-inspired nodes.

After updating Blender add-on files, save your Blender work and restart Blender, or disable and re-enable the add-on, before using the updated tools.

9. ANIMATE A CHARACTER ALREADY IN BLENDER
-----------------------------------------
1. In Studio, choose the matching character or body type and the same export rig used by your Blender character.
2. Select an emote or gameplay motion and click Prepare animation for existing character below the playback controls.
3. In Blender Object Mode, select the existing character, its armature or its ground control. Set the timeline to the frame where the motion should start.
4. Open the ALPHA sidebar and click Apply animation to selected character.

This applies character motion without replacing the outfit, materials or placement. It does not add the emote’s props or cameras. Restore previous animation can restore the prior action and NLA settings.

Use compatible Free Fire Studio rigs. Mixamo, custom rigs, different rest poses and constrained rigs need retargeting first. An armature shared across multiple scenes must be made separate before applying motion.

10. KEEP STUDIO UPDATED
-----------------------
1. In the desktop app, open Updates → Check for updates.
2. If a newer version is available, review the release notes. You can choose Later and keep working.
3. Choose Open customer downloads. Your browser opens Gumroad. Sign in using the account associated with your purchase, or use the download link from your original receipt.
4. Download the new installer from your purchase. Save your work, close Studio, then run the installer over your existing installation.

Automatic checks can be turned off in Updates. Nothing installs or closes Studio automatically. Without internet, keep using the installed version and local library.

The resource library stays in its separate folder. An app update is not a game-resource update; newly added game items may still require updated resources and a rebuilt library.

TROUBLESHOOTING
---------------
The emulator is not listed

Check that Free Fire is installed and its resources are downloaded. Close the emulator and click Look again. If it still does not appear, contact ALPHA with the emulator name, game version and the error shown.

A character, bundle or skin is missing

Check the search and category filters. Under Library, open outfit availability to look up clothing by name or item ID. Catalog entries can exist without matching local models or textures. Missing resources cannot be created by changing a filter.

The Blender button seems to do nothing

Wait until preparation finishes, then import manually from Blender’s ALPHA sidebar. Check that the Inbox folder points to the same library as Studio and that the add-on is enabled.

The model appears in the wrong place

Check Blender’s 3D cursor before importing. Move the asset using its ground control rather than moving individual meshes or bones.

Textures look different from the game

Use ALPHA → Import into this scene for supported custom material nodes. Lighting, shadows, fog, postprocessing and some effects will still differ from the game. Unverified materials can use a fallback shader.

A port error appears

Open the running Studio first; current launchers reuse it. If a different program owns port 4317, close that program or use Open Studio.cmd --port=4318 from the app folder. Do not stop unrelated programs unless you know what they are.

Setup fails or runs out of space

Read the setup error, make more space on the chosen drive and use Try again when offered. Keep original game resources intact. If needed, send ALPHA the exact error and the setup or Studio log from the app folder.

I need help

Email admin@alphaff.gg with your Studio version, emulator name, Blender version when relevant, what you clicked, the exact error and a screenshot. Never send your password or payment-card details.

VIDEO WALKTHROUGH
-----------------
English video tutorial: https://www.youtube.com/watch?v=U67lIrUD1kY
You can also follow the written steps above.
