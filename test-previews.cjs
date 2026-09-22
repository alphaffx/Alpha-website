const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = __dirname;
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, env: process.env });
    let output = '';
    child.stdout.on('data', bytes => { output += bytes; process.stdout.write(bytes); });
    child.stderr.on('data', bytes => { output += bytes; process.stdout.write(bytes); });
    child.once('error', reject); child.once('close', code => resolve({ code, output }));
  });
}
(async () => {
  const fixture = await fs.mkdtemp(path.join(root, '.preview-test-'));
  try {
    for (const name of ['index.html', 'app.js', 'i18n.js', 'style.css', 'generate-previews.cjs', 'watch-models.ps1']) await fs.copyFile(path.join(root, name), path.join(fixture, name));
    await fs.mkdir(path.join(fixture, 'models'));
    const id = 'new model test';
    const source = path.join(fixture, 'models', id + '.glb');
    const preview = path.join(fixture, 'media/models', id + '.webp');
    await fs.copyFile(path.join(root, 'models/alpha.glb'), source);
    const watcher = () => run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(fixture, 'watch-models.ps1'), '-Once'], fixture);
    assert.equal((await watcher()).code, 0);
    const bytes = await fs.readFile(preview);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    const first = await fs.stat(preview);
    assert.equal((await watcher()).code, 0);
    assert.equal((await fs.stat(preview)).mtimeMs, first.mtimeMs, 'unchanged previews must be skipped');
    // Change the source timestamp without changing its length: same-size exports must be detected.
    const future = new Date(Date.now() + 10000); await fs.utimes(source, future, future);
    assert.equal((await watcher()).code, 0);
    assert.notEqual((await fs.stat(preview)).mtimeMs, first.mtimeMs);
    await fs.unlink(preview);
    assert.equal((await watcher()).code, 0);
    const manifestPath = path.join(fixture, 'models/models.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.models[0].tier = 'paid';
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    assert.equal((await run(process.execPath, ['generate-previews.cjs', '--force', '--model', id], fixture)).code, 0);
    const good = await fs.readFile(preview);
    await fs.copyFile(path.join(root, 'models/beesto.glb'), path.join(fixture, 'models/second model.glb'));
    await fs.writeFile(source, Buffer.from('incomplete export'));
    assert.notEqual((await watcher()).code, 0);
    assert.deepEqual(await fs.readFile(preview), good, 'invalid GLBs must preserve existing previews');
    assert((await fs.stat(path.join(fixture, 'media/models/second model.webp'))).size > 1000);
    console.log('PASS: watcher creates previews, handles spaces and paid models, skips unchanged files, detects same-size updates, recreates missing images, and isolates incomplete exports.');
    await fs.copyFile(preview, path.join(root, 'review-auto-preview.webp'));
  } finally {
    const relative = path.relative(root, fixture);
    if (!relative.startsWith('.preview-test-') || relative.includes(path.sep)) throw new Error('Unexpected fixture path; refusing cleanup.');
    await fs.rm(fixture, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
