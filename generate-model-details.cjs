// Inspect exported GLB facts; Blender compatibility must be tested separately.
const fs = require('node:fs');
const path = require('node:path');

function inspectGlb(buffer) {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF' ||
      buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length ||
      buffer.readUInt32LE(16) !== 0x4e4f534a || 20 + buffer.readUInt32LE(12) > buffer.length) {
    throw new Error('Incomplete or invalid GLB');
  }
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8'));
  const images = gltf.images || [];
  return {
    rigged: (gltf.nodes || []).some(node => Number.isInteger(node.skin) && gltf.skins?.[node.skin]?.joints?.length > 0),
    embeddedTextures: images.filter(img => Number.isInteger(img.bufferView) || /^data:/.test(img.uri || '')).length,
    externalTextures: images.filter(img => img.uri && !/^data:/.test(img.uri)).length,
    animations: (gltf.animations || []).map((clip, i) => clip.name || `Animation ${i + 1}`)
  };
}

function generate(root = __dirname) {
  const file = path.join(root, 'models/models.json');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  let failed = false;
  for (const model of catalog.models) {
    if (typeof model.id !== 'string' || /[\\/]/.test(model.id) || ['.', '..'].includes(model.id)) continue;
    try { model.glbDetails = inspectGlb(fs.readFileSync(path.join(root, 'models', model.id + '.glb'))); }
    catch (error) { delete model.glbDetails; failed = true; console.error(`${model.id}: ${error.message}`); }
  }
  const output = JSON.stringify(catalog, null, 2) + '\n';
  if (fs.readFileSync(file, 'utf8') !== output) fs.writeFileSync(file, output);
  return !failed;
}
module.exports = { inspectGlb, generate };
if (require.main === module) process.exitCode = generate() ? 0 : 1;
