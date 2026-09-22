  (function () {
    'use strict';

    /* ============================================================
       MODEL LIST
       The real list comes from models/models.json, rewritten by the
       watcher whenever the models folder changes. This built-in copy
       is only a fallback for when that file cannot be read.
       ============================================================ */
    const FALLBACK_MODELS = [];

    let MODELS = FALLBACK_MODELS.slice();
    let manifestStamp = null;

    const I18N = window.AlphaI18n;
    const t = function (k, v) { return I18N ? I18N.t(k, v) : k; };

    /* ---------- Elements ---------- */
    const tabs        = Array.from(document.querySelectorAll('.tab'));
    const search      = document.getElementById('modelSearch');
    const searchClear = document.getElementById('searchClear');
    const searchHint  = document.getElementById('searchHint');
    const gridFree    = document.getElementById('gridFree');
    const tierFree    = document.getElementById('tierFree');
    const freeCount   = document.getElementById('freeCount');

    const storeModels       = document.getElementById('storeModels');
    const storePresets      = document.getElementById('storePresets');
    const storeOther        = document.getElementById('storeOther');
    const storeModelCount   = document.getElementById('storeModelCount');
    const storePresetCount  = document.getElementById('storePresetCount');
    const storeOtherCount   = document.getElementById('storeOtherCount');
    const storeModelsEmpty  = document.getElementById('storeModelsEmpty');
    const storePresetsEmpty = document.getElementById('storePresetsEmpty');
    const storeOtherEmpty   = document.getElementById('storeOtherEmpty');
    const stage       = document.getElementById('modelStage');
    const viewer      = document.getElementById('mainModel');
    const backdrop    = document.getElementById('modelBackdrop');
    const expandBtn   = document.getElementById('expandBtn');
    const closeBtn    = document.getElementById('closeBtn');
    const loadBtn     = document.getElementById('modelLoad');
    const captionName = document.getElementById('captionName');
    const captionKind = document.getElementById('captionKind');
    const dlGlb       = document.getElementById('dlGlb');
    const dlBlend     = document.getElementById('dlBlend');
    const glbSize     = document.getElementById('glbSize');
    const blendSize   = document.getElementById('blendSize');

    const menuBtn         = document.getElementById('menuBtn');
    const drawer          = document.getElementById('sideMenu');
    const drawerBackdrop  = document.getElementById('drawerBackdrop');
    const drawerClose     = document.getElementById('drawerClose');
    const openSettingsBtn = document.getElementById('openSettings');
    const modal           = document.getElementById('settingsModal');
    const modalBackdrop   = document.getElementById('settingsBackdrop');
    const settingsClose   = document.getElementById('settingsClose');
    const langGrid        = document.getElementById('langGrid');
    const cbAutoRotate    = document.getElementById('setAutoRotate');
    const cbReduceMotion  = document.getElementById('setReduceMotion');
    const cbDataSaver     = document.getElementById('setDataSaver');

    let currentId = null;
    let currentModel = null;
    let query = '';

    /* ============================================================
       SETTINGS
       Stored per browser. Reads and writes are wrapped because
       storage throws in private mode and some embedded browsers.
       ============================================================ */
    const SETTINGS_KEY = 'alpha.settings';

    const settings = { autoRotate: true, reduceMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, dataSaver: !!(navigator.connection && navigator.connection.saveData) };

    function loadSettings() {
      let raw = null;
      try { raw = localStorage.getItem(SETTINGS_KEY); } catch (e) { return; }
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (typeof saved.autoRotate   === 'boolean') settings.autoRotate   = saved.autoRotate;
        if (typeof saved.reduceMotion === 'boolean') settings.reduceMotion = saved.reduceMotion;
        if (typeof saved.dataSaver    === 'boolean') settings.dataSaver    = saved.dataSaver;
      } catch (e) { /* corrupt value, keep defaults */ }
    }

    function saveSettings() {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* blocked */ }
    }

    function applySettings() {
      if (settings.autoRotate && !settings.reduceMotion) viewer.setAttribute('auto-rotate', '');
      else viewer.removeAttribute('auto-rotate');

      document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);

      cbAutoRotate.checked   = settings.autoRotate;
      cbReduceMotion.checked = settings.reduceMotion;
      cbDataSaver.checked    = settings.dataSaver;
    }

    cbAutoRotate.addEventListener('change', function () {
      settings.autoRotate = cbAutoRotate.checked; saveSettings(); applySettings();
    });

    cbReduceMotion.addEventListener('change', function () {
      settings.reduceMotion = cbReduceMotion.checked; saveSettings(); applySettings();
    });

    cbDataSaver.addEventListener('change', function () {
      settings.dataSaver = cbDataSaver.checked;
      saveSettings(); applySettings();
      // Turning it off should load whatever is selected right away.
      if (!settings.dataSaver && currentModel && !viewer.getAttribute('src')) loadNow();
    });

    /* ============================================================
       MENU + MODAL
       ============================================================ */
    function openDrawer() {
      focusReturn = menuBtn;
      drawer.hidden = false; drawerBackdrop.hidden = false;
      requestAnimationFrame(function () { drawer.classList.add('is-open'); });
      menuBtn.setAttribute('aria-expanded', 'true');
      drawerClose.focus();
    }

    function closeDrawer() {
      drawer.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      window.setTimeout(function () {
        drawer.hidden = true; drawerBackdrop.hidden = true;
      }, settings.reduceMotion ? 0 : 260);
    }

    function openModal() {
      focusReturn = menuBtn;
      modal.hidden = false; modalBackdrop.hidden = false;
      requestAnimationFrame(function () { modal.classList.add('is-open'); });
      settingsClose.focus();
    }

    function closeModal() {
      modal.classList.remove('is-open');
      window.setTimeout(function () {
        modal.hidden = true; modalBackdrop.hidden = true;
      }, settings.reduceMotion ? 0 : 220);
    }

    menuBtn.addEventListener('click', function () {
      if (drawer.hidden) openDrawer(); else closeDrawer();
    });
    drawerClose.addEventListener('click', closeDrawer);
    drawerBackdrop.addEventListener('click', closeDrawer);

    openSettingsBtn.addEventListener('click', function () { closeDrawer(); openModal(); });
    settingsClose.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    /* ============================================================
       LANGUAGE PICKER
       ============================================================ */
    function buildLangGrid() {
      if (!I18N) return;
      langGrid.innerHTML = '';
      I18N.langs.forEach(function (l) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lang-btn' + (l.code === I18N.current ? ' is-active' : '');
        b.textContent = l.name;
        b.setAttribute('lang', l.code);
        b.dataset.code = l.code;
        b.addEventListener('click', function () { I18N.set(l.code); });
        langGrid.appendChild(b);
      });
    }

    document.addEventListener('alpha:langchange', function () {
      buildLangGrid();
      renderPicker();
      if (currentModel) applyMeta(currentModel);
      if (loadBtn.hidden === false && currentModel) {
        loadBtn.textContent = t('data.load', { size: currentModel.glb || '' });
      }
      renderPresets(presets);
      renderStore();
    });

    /* ============================================================
       TABS
       ============================================================ */
    function activeTab() {
      const a = tabs.filter(function (x) { return x.classList.contains('is-active'); })[0];
      return a ? a.id.replace('tab-', '') : 'home';
    }

    function showPanel(name, updateRoute = true) {
      if (isExpanded()) collapseModel();
      if (!tabs.some(tab => tab.id === 'tab-' + name && !tab.hidden)) name = 'home';
      if (updateRoute) history.pushState(null, '', '#' + name + (name === 'models' && currentId ? '/' + encodeURIComponent(currentId) : ''));
      if (name === 'models' && !currentModel && firstFree()) selectModel(firstFree().id, false, false);
      else if (name === 'models' && currentModel && !viewer.getAttribute('src') && !settings.dataSaver) loadNow();
      tabs.forEach(function (tab) {
        const isTarget = tab.id === 'tab-' + name;
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        tab.classList.toggle('is-active', isTarget);
        tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        tab.tabIndex = isTarget ? 0 : -1;
        if (panel) {
          panel.hidden = !isTarget;
          panel.classList.toggle('is-active', isTarget);
        }
      });
      window.scrollTo({ top: 0, behavior: settings.reduceMotion ? 'auto' : 'smooth' });

      // the models tab gets a wider page than the rest of the site
      document.body.classList.toggle('on-models', name === 'models');

      // the panes only have a measurable height once the panel is visible
      if (name === 'models') {
        window.requestAnimationFrame(sizeLibrary);
        window.setTimeout(sizeLibrary, 320);   // again after the scroll settles
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { showPanel(tab.id.replace('tab-', '')); });
    });

    document.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showPanel(btn.dataset.goto);
        if (!drawer.hidden) closeDrawer();
      });
    });

    /* ============================================================
       SEARCH
       ============================================================ */
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function isSubsequence(q, text) {
      let i = 0;
      for (let j = 0; j < text.length && i < q.length; j++) if (text[j] === q[i]) i++;
      return i === q.length;
    }

    function matchScore(q, m) {
      const name = String(m.name || '').toLowerCase();
      const id   = String(m.id   || '').toLowerCase();
      if (name === q || id === q)                         return 900;
      if (name.indexOf(q) === 0 || id.indexOf(q) === 0)   return 800 - name.length;
      const at = name.indexOf(q);
      if (at > -1)                                        return 700 - at;
      if (id.indexOf(q) > -1)                             return 690;
      if (isSubsequence(q, name) || isSubsequence(q, id)) return 600;
      return 0;
    }

    function distance(a, b) {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      let prev = [];
      for (let j = 0; j <= b.length; j++) prev[j] = j;
      for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        prev = row;
      }
      return prev[b.length];
    }

    function rank(raw) {
      const q = String(raw || '').trim().toLowerCase();
      if (!q) return { mode: 'all', items: MODELS.slice() };

      const hits = MODELS
        .map(function (m) { return { m: m, s: matchScore(q, m) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .map(function (x) { return x.m; });

      if (hits.length) return { mode: 'match', items: hits };

      const near = MODELS
        .map(function (m) {
          return { m: m, d: Math.min(distance(q, String(m.name).toLowerCase()),
                                     distance(q, String(m.id).toLowerCase())) };
        })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 3)
        .map(function (x) { return x.m; });

      return { mode: 'closest', items: near };
    }

    function highlight(name, raw) {
      const q = String(raw || '').trim().toLowerCase();
      if (!q) return esc(name);
      const at = String(name).toLowerCase().indexOf(q);
      if (at < 0) return esc(name);
      return esc(name.slice(0, at)) +
             '<mark>' + esc(name.slice(at, at + q.length)) + '</mark>' +
             esc(name.slice(at + q.length));
    }

    function isPaid(m) { return m.tier === 'paid'; }

    function cardFor(m) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'model-card' + (m.id === currentId ? ' is-active' : '');
      btn.dataset.id = m.id;
      btn.setAttribute('aria-pressed', String(m.id === currentId));
      const thumb = document.createElement('img');
      thumb.src = './media/models/' + encodeURIComponent(m.id) + '.webp';
      thumb.alt = ''; thumb.loading = 'lazy'; thumb.width = 96; thumb.height = 112;
      thumb.addEventListener('error', () => { thumb.hidden = true; });
      btn.appendChild(thumb);

      const name = document.createElement('span');
      name.className = 'model-card-name';
      name.innerHTML = highlight(m.name, query);
      btn.appendChild(name);
      const detail = document.createElement('small');
      detail.textContent = 'GLB' + (m.hasBlend ? ' + BLEND' : '') + ' · ' + m.glb;
      btn.appendChild(detail);

      if (isPaid(m)) {
        const tag = document.createElement('span');
        tag.className = 'model-card-badge';
        tag.textContent = m.price ? m.price : t('badge.paid');
        btn.appendChild(tag);
      }

      btn.addEventListener('click', function () {
        selectModel(m.id);
        Array.from(gridFree.querySelectorAll('button')).find(el => el.dataset.id === m.id)?.focus({ preventScroll: true });
        // The library sits above the viewer, so bring the model into view
        // instead of leaving the visitor looking at the card they clicked.
        try {
          stage.scrollIntoView({
            behavior: settings.reduceMotion ? 'auto' : 'smooth',
            block: 'center'
          });
        } catch (e) { stage.scrollIntoView(); }
      });
      return btn;
    }

    function fill(grid, list) {
      grid.innerHTML = '';
      list.forEach(function (m) { grid.appendChild(cardFor(m)); });
    }

    function renderPicker() {
      const res = rank(query);
      const searching = !!query.trim();

      // Premium models live in the Store now, not in this list.
      const free = res.items.filter(function (m) { return !isPaid(m); });

      fill(gridFree, free);

      const totalFree = MODELS.filter(function (m) { return !isPaid(m); }).length;
      freeCount.textContent = searching ? free.length + ' / ' + totalFree : String(totalFree);
      tierFree.hidden = searching && free.length === 0;

      searchClear.hidden = !query;

      const typed = query.trim();
      if (res.mode === 'closest') {
        searchHint.hidden = false;
        searchHint.textContent = t('search.noMatch', { q: typed });
      } else if (res.mode === 'match' && typed) {
        searchHint.hidden = false;
        searchHint.textContent = t('search.count', { n: res.items.length, m: MODELS.length });
      } else {
        searchHint.hidden = true;
        searchHint.textContent = '';
      }
    }

    search.addEventListener('input', function () { query = search.value; renderPicker(); });

    search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = document.querySelector('#panel-models .model-card');
        if (first) { selectModel(first.dataset.id); search.blur(); }
      } else if (e.key === 'Escape') {
        clearSearch();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const first = document.querySelector('#panel-models .model-card');
        if (first) first.focus();
      }
    });

    function clearSearch() { query = ''; search.value = ''; renderPicker(); }

    searchClear.addEventListener('click', function () { clearSearch(); search.focus(); });

    document.addEventListener('keydown', function (e) {
      if (activeTab() !== 'models') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (stage.classList.contains('expanded')) return;
      if (!drawer.hidden || !modal.hidden) return;

      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key.length === 1 && /\S/.test(e.key)) search.focus();
    });

    /* ============================================================
       MODEL SWITCHING
       ============================================================ */
    let swapTimer = null;
    let safetyTimer = null;

    // Several files are named with spaces ("le chris.glb"), so the name has
    // to be encoded or the request 404s on a stricter server.
    function fileFor(m, ext) { return './models/' + encodeURIComponent(m.id) + ext; }
    function srcFor(m) { return fileFor(m, '.glb'); }

    function applyMeta(m) {
      captionName.textContent = m.name;
      captionKind.textContent = m.kind ? m.kind : t('viewer.kind');
      viewer.setAttribute('alt', m.name);

      const locked = isPaid(m);

      dlGlb.href = locked ? '#' : srcFor(m);
      dlGlb.setAttribute('download', m.id + '.glb');
      glbSize.textContent = locked ? t('dl.locked') : (m.glb || '');

      const hasBlend = m.hasBlend !== false;
      dlBlend.href = (hasBlend && !locked) ? fileFor(m, '.blend') : '#';
      dlBlend.setAttribute('download', m.id + '.blend');
      blendSize.textContent = locked ? t('dl.locked')
                            : (hasBlend ? (m.blend || '') : t('dl.missing'));

      dlBlend.classList.toggle('is-missing', !hasBlend && !locked);
      dlGlb.classList.toggle('is-locked', locked);
      dlBlend.classList.toggle('is-locked', locked);
      dlGlb.setAttribute('aria-disabled', locked ? 'true' : 'false');
      dlBlend.setAttribute('aria-disabled', (locked || !hasBlend) ? 'true' : 'false');
    }

    function finishSwap() {
      window.clearTimeout(safetyTimer);
      viewer.classList.remove('is-swapping');
    }

    function showLoadButton(m) {
      window.clearTimeout(swapTimer);
      window.clearTimeout(safetyTimer);
      viewer.classList.remove('is-swapping');
      viewer.removeAttribute('src');
      loadBtn.hidden = false;
      loadBtn.textContent = t('data.load', { size: m.glb || '' });
    }

    let viewerImport;
    async function loadNow(force = false) {
      if (!currentModel) return;
      loadBtn.hidden = true;
      const status = document.getElementById('viewerStatus');
      status.hidden = false; status.textContent = t('upgrade.loadingModel');
      try {
        if (!viewerImport) viewerImport = import('https://unpkg.com/@google/model-viewer@4.3.1/dist/model-viewer.min.js').catch(e => { viewerImport = null; throw e; });
        await viewerImport;
        if ((!force && settings.dataSaver) || activeTab() !== 'models' || library.classList.contains('preview-closed')) { status.hidden = true; return; }
        viewer.setAttribute('src', srcFor(currentModel));
      } catch (e) { viewerFailed(); }
    }
    function viewerFailed() {
      finishSwap();
      viewer.removeAttribute('src');
      const status = document.getElementById('viewerStatus');
      status.hidden = false; status.textContent = t('upgrade.modelError');
      loadBtn.hidden = false; loadBtn.textContent = t('upgrade.retry');
    }

    loadBtn.addEventListener('click', () => loadNow(true));

    function selectModel(id, force, updateRoute = true) {
      if (library.classList.contains('preview-closed')) { openPreview(); force = true; }
      if (id === currentId && !force) return;
      const m = MODELS.filter(function (x) { return x.id === id; })[0];
      if (!m || isPaid(m)) return;

      const isFirst = currentId === null;
      window.clearTimeout(swapTimer);
      window.clearTimeout(safetyTimer);
      currentId = id;
      currentModel = m;
      if (updateRoute) history.pushState(null, "", "#models/" + encodeURIComponent(id));
      applyMeta(m);
      renderPicker();

      if (settings.dataSaver) { showLoadButton(m); return; }

      loadBtn.hidden = true;

      if (isFirst || settings.reduceMotion) {
        loadNow();
        return;
      }

      viewer.classList.add('is-swapping');
      window.clearTimeout(swapTimer);
      window.clearTimeout(safetyTimer);

      swapTimer = window.setTimeout(function () {
        loadNow();
        safetyTimer = window.setTimeout(finishSwap, 8000);
      }, 300);
    }

    /* ============================================================
       AUTOMATIC MATERIAL FIX
       These character exports arrive with metalness switched on, and
       in most of them the colour texture is also wired in as the
       roughness map, so the character renders as chrome. This runs on
       every model as it loads, including ones added in future.
       ============================================================ */
    const MATERIAL_FIX = { enabled: true, metallic: 0, roughness: 0.6 };

    function sameImage(a, b) {
      if (!a || !b) return false;
      try {
        if (a === b) return true;
        if (a.texture && b.texture && a.texture === b.texture) return true;
        const sa = a.texture && a.texture.source;
        const sb = b.texture && b.texture.source;
        if (sa && sb) {
          if (sa === sb) return true;
          if (sa.uri && sb.uri && sa.uri === sb.uri) return true;
          if (sa.name && sb.name && sa.name === sb.name) return true;
        }
      } catch (e) { /* fall through */ }
      return false;
    }

    function fixMaterials() {
      if (!MATERIAL_FIX.enabled) return;
      let model = null;
      try { model = viewer.model; } catch (e) { return; }
      if (!model || !model.materials || !model.materials.length) return;

      model.materials.forEach(function (mat) {
        try {
          if (typeof mat.ensureLoaded === 'function') mat.ensureLoaded();
          const pbr = mat.pbrMetallicRoughness;
          if (!pbr) return;

          if (typeof pbr.setMetallicFactor === 'function') {
            pbr.setMetallicFactor(MATERIAL_FIX.metallic);
          }

          const baseInfo = pbr.baseColorTexture;
          const mrInfo   = pbr.metallicRoughnessTexture;

          if (mrInfo && mrInfo.texture && sameImage(baseInfo, mrInfo)) {
            if (typeof mrInfo.setTexture === 'function') mrInfo.setTexture(null);
            if (typeof pbr.setRoughnessFactor === 'function') {
              pbr.setRoughnessFactor(MATERIAL_FIX.roughness);
            }
          }
        } catch (e) { /* one odd material must not stop the others */ }
      });
    }

    viewer.addEventListener('load', function () { document.getElementById('viewerStatus').hidden = true; fixMaterials(); finishSwap(); resetView(); });
    viewer.addEventListener('error', viewerFailed);

    // Premium models can be previewed but not downloaded yet.
    [dlGlb, dlBlend].forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (el.classList.contains('is-locked') || el.classList.contains('is-missing')) {
          e.preventDefault();
        }
      });
    });

    /* ============================================================
       FULLSCREEN
       ============================================================ */
    let fitTimer = null;

    function refit() {
      if (typeof viewer.updateFraming !== 'function') return;
      let orbit = null;
      try {
        if (typeof viewer.getCameraOrbit === 'function') orbit = viewer.getCameraOrbit();
      } catch (e) { /* not ready */ }

      viewer.updateFraming().then(function () {
        viewer.cameraOrbit = orbit
          ? orbit.theta + 'rad ' + orbit.phi + 'rad 105%'
          : 'auto auto 105%';
      }).catch(function () { /* ignore */ });
    }

    /* refit() keeps whatever angle you were looking from and only pulls the
       camera back. resetView() puts everything back to how the model first
       loaded - needed because a stray pinch can zoom inside the model and
       there was previously no way out but reloading the page. */
    function resetView() {
      if (typeof viewer.updateFraming !== 'function') return;
      viewer.updateFraming().then(function () {
        viewer.cameraOrbit  = 'auto auto 105%';
        viewer.fieldOfView  = 'auto';
      }).catch(function () { /* ignore */ });
    }

    function scheduleRefit() {
      window.clearTimeout(fitTimer);
      fitTimer = window.setTimeout(refit, 140);
    }

    function isExpanded() { return stage.classList.contains('expanded'); }

    const stageAnchor = document.createComment('3D viewer position');
    stage.before(stageAnchor);
    let viewerScrollY = 0;

    function expandModel() {
      if (isExpanded()) return;
      focusReturn = expandBtn;
      viewerScrollY = window.scrollY;
      document.body.appendChild(stage);
      stage.classList.add('expanded');
      stage.setAttribute('role', 'dialog');
      stage.setAttribute('aria-modal', 'true');
      stage.setAttribute('aria-label', currentModel ? currentModel.name : '3D preview');
      expandBtn.hidden = true;
      document.body.style.overflow = 'hidden';
      viewer.setAttribute('touch-action', 'none');
      syncOverlay();
      closeBtn.focus({ preventScroll: true });
      scheduleRefit();
    }

    function collapseModel() {
      if (!isExpanded()) return;
      stage.classList.remove('expanded');
      stageAnchor.after(stage);
      stage.removeAttribute('role');
      stage.removeAttribute('aria-modal');
      stage.removeAttribute('aria-label');
      expandBtn.hidden = false;
      document.body.style.overflow = '';
      viewer.setAttribute('touch-action', 'pan-y');
      syncOverlay();
      window.scrollTo({ top: viewerScrollY, behavior: 'instant' });
      scheduleRefit();
    }

    document.getElementById('resetBtn').addEventListener('click', resetView);
    expandBtn.addEventListener('click', expandModel);
    closeBtn.addEventListener('click', () => {
      if (isExpanded()) collapseModel();
      else closePreview();
    });
    backdrop.addEventListener('click', collapseModel);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (isExpanded()) { collapseModel(); return; }
      if (!modal.hidden)  { closeModal();  return; }
      if (!drawer.hidden) { closeDrawer(); }
    });

    // Fullscreen is explicit: tapping or dragging a model must not interrupt scrolling.

    window.addEventListener('resize', scheduleRefit);

    /* ============================================================
       LIBRARY HEIGHT

       The two panes scroll independently, which needs a real pixel
       height. It is measured rather than hard-coded so it survives
       the heading wrapping, a different font, or a themed tab bar.
       ============================================================ */
    const library = document.querySelector('.library');
    const reopenViewer = document.getElementById('reopenViewer');
    function browseModels() {
      search.focus({ preventScroll: true });
      search.scrollIntoView({ block: 'start', behavior: settings.reduceMotion ? 'instant' : 'smooth' });
    }
    function closePreview() {
      window.clearTimeout(swapTimer);
      window.clearTimeout(safetyTimer);
      library.classList.add('preview-closed');
      document.querySelector('.library-preview').hidden = true;
      document.querySelector('.library-side').hidden = true;
      viewer.removeAttribute('src');
      reopenViewer.hidden = false;
      sizeLibrary();
      browseModels();
    }
    function openPreview() {
      library.classList.remove('preview-closed');
      document.querySelector('.library-preview').hidden = false;
      document.querySelector('.library-side').hidden = false;
      reopenViewer.hidden = true;
      sizeLibrary();
    }
    reopenViewer.addEventListener('click', () => {
      if (currentModel) selectModel(currentModel.id, true, false);
      closeBtn.focus({ preventScroll: true });
      stage.scrollIntoView({ block: 'center', behavior: settings.reduceMotion ? 'instant' : 'smooth' });
    });
    document.getElementById('browseModels').addEventListener('click', browseModels);

    function sizeLibrary() {
      if (!library) return;

      if (window.innerWidth <= 900) {   // phones keep normal page scrolling
        library.style.height = '';
        return;
      }

      library.style.height = 'auto';
      const top = library.getBoundingClientRect().top;
      const available = window.innerHeight - top - 24;   // 24px breathing room
      library.style.height = Math.max(380, available) + 'px';
    }

    window.addEventListener('resize', sizeLibrary);

    /* ============================================================
       COLOUR CORRECTION TAB

       Before/after images live in media/ and presets in presets/.
       Both are optional: if the files are not there yet the section
       shows its "coming soon" note instead of a broken image.
       ============================================================ */
    const baWrap   = document.getElementById('baWrap');
    const baBefore = document.getElementById('baBefore');
    const baAfter  = document.getElementById('baAfter');
    const baHandle = document.getElementById('baHandle');
    const baRange  = document.getElementById('baRange');
    const baHint   = document.getElementById('baHint');
    const baEmpty  = document.getElementById('baEmpty');

    const presetGrid  = document.getElementById('presetGrid');
    const presetCount = document.getElementById('presetCount');
    const presetEmpty = document.getElementById('presetEmpty');

    function setCompare(v) {
      const pct = Math.max(0, Math.min(100, Number(v)));
      // clip-path keeps both images at full container size, so they stay
      // aligned however the box is resized.
      baBefore.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      baHandle.style.insetInlineStart = pct + '%';
    }

    baRange.addEventListener('input', function () { setCompare(baRange.value); });

    function showCompare() {
      baWrap.hidden = false;
      baHint.hidden = false;
      baEmpty.hidden = true;
      setCompare(baRange.value);
    }

    // Both images have to load before the comparison means anything.
    (function initCompare() {
      let ready = 0, failed = false;
      function done() {
        ready++;
        if (!failed && ready === 2) showCompare();
      }
      function fail() { failed = true; baWrap.hidden = true; baEmpty.hidden = false; }

      [baBefore, baAfter].forEach(function (img) {
        if (img.complete) { (img.naturalWidth ? done : fail)(); return; }
        img.addEventListener('load', done);
        img.addEventListener('error', fail);
      });
    })();

    function renderPresets(all) {
      // paid presets are shown in the Store instead
      const list = all.filter(function (p) { return p.tier !== 'paid'; });
      presetGrid.innerHTML = '';

      list.forEach(function (p) {
        const a = document.createElement('a');
        a.className = 'preset-card';
        a.href = './presets/' + encodeURIComponent(p.file);
        a.setAttribute('download', p.file);

        const name = document.createElement('span');
        name.className = 'preset-name';
        name.textContent = p.name || p.file;
        a.appendChild(name);

        if (p.desc) {
          const d = document.createElement('span');
          d.className = 'preset-desc';
          d.textContent = p.desc;
          a.appendChild(d);
        }

        const foot = document.createElement('span');
        foot.className = 'preset-foot';
        foot.textContent = (p.size || '') + '  ' + t('dl.action');
        a.appendChild(foot);

        presetGrid.appendChild(a);
      });

      presetCount.textContent = list.length ? String(list.length) : '';
      presetEmpty.hidden = list.length > 0;
    }

    let presets = [];

    function loadPresets() {
      return fetch('./presets/presets.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('none'); return r.json(); })
        .then(function (d) {
          presets = (Array.isArray(d.presets) ? d.presets : [])
            .filter(function (p) { return p && p.file; })
            .map(function (p) {
              p.tier = String(p.tier || 'free').toLowerCase() === 'paid' ? 'paid' : 'free';
              return p;
            });
          renderPresets(presets);
          renderStore();
        })
        .catch(function () { presets = []; renderPresets(presets); renderStore(); });
    }

    /* ============================================================
       STORE

       Everything paid lives here: premium models and presets are
       whatever is marked "tier":"paid" in their own manifest, plus
       anything listed by hand in store.json (courses, lessons, and
       anything else that isn't a file in models/ or presets/).
       ============================================================ */
    let storeExtras = [];

    function storeCard(opts) {
      const el = document.createElement('div');
      el.className = 'store-card' + (opts.url ? '' : ' is-soon');

      /* ---- picture slideshow -------------------------------------
         opts.images is a list of paths written into store.json by
         watch-models.bat. Drop pictures into media/store/<slug>/ and
         run the watcher; they appear here. No pictures = no slideshow,
         and the card just shows text.                               */
      /* PowerShell can collapse a one-item list to a plain string, so accept both */
      const rawShots = opts.images;
      const shots = (Array.isArray(rawShots) ? rawShots : (rawShots ? [rawShots] : []))
                      .filter(Boolean).map(function (u) { return encodeURI(u); });
      if (shots.length) {
        const box = document.createElement('div');
        box.className = 'store-shots';

        const img = document.createElement('img');
        img.className = 'store-shot';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = opts.title || '';
        img.src = shots[0];
        const imageButton = document.createElement('button');
        imageButton.type = 'button'; imageButton.className = 'store-image-button';
        imageButton.setAttribute('aria-label', opts.title || t('upgrade.preview'));
        imageButton.appendChild(img); box.appendChild(imageButton);

        if (shots.length > 1) {
          let i = 0;
          const strip = document.createElement('div');
          strip.className = 'shot-dots';

          const dots = shots.map(function (_, k) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'shot-dot' + (k === 0 ? ' is-on' : '');
            b.setAttribute('aria-label', String(k + 1));   /* a number needs no translation */
            strip.appendChild(b);
            return b;
          });

          const show = function (n) {
            i = (n + shots.length) % shots.length;
            img.src = shots[i];
            el.__shot = i;
            dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
          };

          dots.forEach(function (b, k) {
            b.addEventListener('click', function () { show(k); });
          });


          box.appendChild(strip);
        }
        /* tapping the picture opens the full-screen viewer at that shot */
        img.classList.add('is-tappable');
        imageButton.addEventListener('click', function () {
          openLightbox(shots, el.__shot || 0, opts.title || '');
        });

        el.appendChild(box);
      }

      const head = document.createElement('div');
      head.className = 'store-card-head';

      const name = document.createElement('span');
      name.className = 'store-card-name';
      name.textContent = opts.title;
      head.appendChild(name);

      const price = document.createElement('span');
      price.className = 'store-card-price';
      price.textContent = opts.price || t('badge.paid');
      head.appendChild(price);

      el.appendChild(head);

      if (opts.desc) {
        const d = document.createElement('p');
        d.className = 'store-card-desc';
        d.textContent = opts.desc;
        el.appendChild(d);
      }

      /* The card is a div, not a link, because the dots inside it are
         buttons and a button inside a link is broken for keyboards and
         screen readers. The buy link is its own element instead.      */
      if (opts.url) {
        const buy = document.createElement('a');
        buy.className = 'store-card-buy';
        buy.href = opts.url;
        buy.target = '_blank';
        buy.rel = 'noopener noreferrer';
        buy.textContent = t('store.view');
        el.appendChild(buy);
      } else {
        const foot = document.createElement('span');
        foot.className = 'store-card-foot';
        foot.textContent = t('store.soon');
        el.appendChild(foot);
      }

      return el;
    }

    /* ============================================================
       STORE LIGHTBOX
       Tapping a product picture opens it full screen. Arrows, dots,
       swipe, arrow keys and Escape all work.
       ============================================================ */
    const lb      = document.getElementById('storeLb');
    const lbImg   = document.getElementById('lbImg');
    const lbCap   = document.getElementById('lbCap');
    const lbDots  = document.getElementById('lbDots');
    const lbPrev  = document.getElementById('lbPrev');
    const lbNext  = document.getElementById('lbNext');
    const lbClose = document.getElementById('lbClose');

    let lbShots = [];
    let lbAt    = 0;
    let lbOpener = null;

    function lbGo(n) {
      if (!lbShots.length) return;
      lbAt = (n + lbShots.length) % lbShots.length;
      lbImg.src = lbShots[lbAt];
      Array.prototype.forEach.call(lbDots.children, function (d, k) {
        d.classList.toggle('is-on', k === lbAt);
      });
      const many = lbShots.length > 1;
      lbPrev.hidden = lbNext.hidden = !many;
      lbDots.hidden = !many;
    }

    function openLightbox(shots, at, caption) {
      lbShots = shots || [];
      if (!lbShots.length) return;
      lbOpener = document.activeElement;
      focusReturn = lbOpener;

      lbDots.innerHTML = '';
      lbShots.forEach(function (_, k) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lb-dot';
        b.setAttribute('aria-label', String(k + 1));
        b.addEventListener('click', function () { lbGo(k); });
        lbDots.appendChild(b);
      });

      lbCap.textContent = caption || '';
      lbImg.alt = caption || '';
      lb.hidden = false;
      document.body.classList.add('lb-open');
      lbGo(at || 0);
      lbClose.focus();
    }

    function closeLightbox() {
      lb.hidden = true;
      lbImg.removeAttribute('src');          /* stop it holding the picture in memory */
      document.body.classList.remove('lb-open');
      if (lbOpener && lbOpener.focus) lbOpener.focus();
      lbOpener = null;
    }

    lbPrev.addEventListener('click', function () { lbGo(lbAt - 1); });
    lbNext.addEventListener('click', function () { lbGo(lbAt + 1); });
    lbClose.addEventListener('click', closeLightbox);

    /* clicking the dark area around the picture closes it */
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape')     { e.preventDefault(); closeLightbox(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); lbGo(lbAt - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); lbGo(lbAt + 1); }
    });

    /* swipe on a phone */
    (function () {
      let x0 = null;
      lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 45) lbGo(lbAt + (dx < 0 ? 1 : -1));
        x0 = null;
      }, { passive: true });
    })();

    /* ============================================================
       STORE SEARCH
       Hidden until the store outgrows a single glance.
       ============================================================ */
    const STORE_SEARCH_MIN = 6;
    const storeSearch = document.getElementById('storeSearch');
    const storeQ      = document.getElementById('storeQ');
    const storeQClear = document.getElementById('storeQClear');
    const storeNone   = document.getElementById('storeNone');

    function applyStoreFilter() {
      const q = (storeQ.value || '').trim().toLowerCase();
      storeQClear.hidden = !q;

      let shown = 0, total = 0;
      document.querySelectorAll('#panel-store .store-card').forEach(function (card) {
        total++;
        const hay = (card.textContent || '').toLowerCase();
        const hit = !q || hay.indexOf(q) !== -1;
        card.hidden = !hit;
        if (hit) shown++;
      });

      storeNone.hidden = !(q && shown === 0);
      if (!storeNone.hidden) storeNone.textContent = t('store.noMatch', { q: storeQ.value });
      storeSearch.hidden = total <= STORE_SEARCH_MIN;
    }

    storeQ.addEventListener('input', applyStoreFilter);
    storeQClear.addEventListener('click', function () {
      storeQ.value = '';
      applyStoreFilter();
      storeQ.focus();
    });

    function fillStore(grid, empty, count, items) {
      grid.innerHTML = '';
      items.forEach(function (it) { grid.appendChild(storeCard(it)); });
      empty.hidden = items.length > 0;
      count.textContent = items.length ? String(items.length) : '';
    }

    function renderStore() {
      fillStore(storeModels, storeModelsEmpty, storeModelCount,
        MODELS.filter(isPaid).map(function (m) {
          return { title: m.name, desc: m.kind || '', price: m.price, url: m.url || '' };
        }));

      fillStore(storePresets, storePresetsEmpty, storePresetCount,
        presets.filter(function (p) { return p.tier === 'paid'; }).map(function (p) {
          return { title: p.name || p.file, desc: p.desc || '', price: p.price, url: p.url || '' };
        }));

      fillStore(storeOther, storeOtherEmpty, storeOtherCount,
        storeExtras.map(function (x) {
          return { title: x.title || '', desc: x.desc || '', price: x.price,
                   url: x.url || '', images: x.images || [] };
        }));

      applyStoreFilter();
    }

    function loadStoreExtras() {
      document.getElementById('storeStatus').textContent = t('upgrade.loading');
      document.getElementById('storeRetry').hidden = true;
      return fetch('./store.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('none'); return r.json(); })
        .then(function (d) {
          document.getElementById('storeStatus').textContent = '';
          storeExtras = Array.isArray(d.items) ? d.items.filter(function (x) { return x && x.title; }) : [];
        })
        .catch(function () { document.getElementById('storeStatus').textContent = t('upgrade.catalogError'); document.getElementById('storeRetry').hidden = false; })
        .then(function () { renderStore(); if (!document.getElementById('storeRetry').hidden) storeOtherEmpty.hidden = true; });
    }

    /* ============================================================
       MANIFEST
       ============================================================ */
    function normalise(raw) {
      return raw
        .filter(function (m) { return m && m.id; })
        .map(function (m) {
          const kind = String(m.kind || '');
          return {
            id:       String(m.id),
            name:     String(m.name || m.id),
            // "3D model" is the watcher's default, so let it translate
            kind:     /^3d model$/i.test(kind) ? '' : kind,
            glb:      String(m.glb || ''),
            blend:    String(m.blend || ''),
            hasBlend: m.hasBlend !== false,
            // anything not explicitly marked "paid" is free
            tier:     String(m.tier || 'free').toLowerCase() === 'paid' ? 'paid' : 'free',
            price:    String(m.price || '')
          };
        });
    }

    function loadManifest() {
      document.getElementById('catalogStatus').textContent = t('upgrade.loading');
      document.getElementById('catalogRetry').hidden = true;
      return fetch('./models/models.json', { cache: 'no-cache' })
        .then(function (res) { if (!res.ok) throw new Error('no manifest'); return res.json(); })
        .then(function (data) {
          const list = normalise(Array.isArray(data.models) ? data.models : []);
          document.getElementById('catalogStatus').textContent = list.length ? '' : t('upgrade.empty');
          const stamp = String(data.generated || '') + '|' +
                        list.map(function (m) { return m.id + ':' + m.glb + ':' + m.tier; }).join(',');
          if (stamp === manifestStamp) return false;
          manifestStamp = stamp;
          MODELS = list;
          return true;
        })
        .catch(function () { document.getElementById('catalogStatus').textContent = t('upgrade.catalogError'); document.getElementById('catalogRetry').hidden = false; return false; });
    }

    function firstFree() {
      return MODELS.filter(function (m) { return !isPaid(m); })[0];
    }

    function applyModelList() {
      const current = MODELS.filter(function (m) { return m.id === currentId; })[0];
      const first = firstFree();
      if ((!current || isPaid(current)) && first) selectModel(first.id, true);
      else renderPicker();
      renderStore();
    }

    /* ============================================================
       INIT
       ============================================================ */
    loadSettings();
    /* ============================================================
       FEEDBACK FORM
       ------------------------------------------------------------
       The site is static, so it cannot send email itself. The form
       posts to FormSubmit, a free relay that forwards the message
       to the address below.

       IMPORTANT: the very first message sent will NOT arrive. Instead
       FormSubmit emails that address a confirmation link. Click it
       once and every message after that comes straight through.
       ============================================================ */
    (function () {
      const form = document.getElementById('fbForm');
      if (!form) return;

      const FB_TO   = 'admin@alphaff.gg';
      const btn     = document.getElementById('fbSend');
      const status  = document.getElementById('fbStatus');
      const msgBox  = document.getElementById('fbMsg');
      const mailBox = document.getElementById('fbEmail');
      const honey   = document.getElementById('fbHoney');

      function say(key, ok) {
        status.hidden = false;
        status.textContent = t(key);
        status.classList.toggle('is-ok', ok === true);
        status.classList.toggle('is-err', ok === false);
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (!mailBox.reportValidity()) return;
        const body = msgBox.value.trim();
        if (!body) { msgBox.focus(); return; }

        // A filled honeypot means a bot. Show success and send nothing.
        if (honey.value) { form.reset(); say('contact.fbOk', true); return; }

        btn.disabled = true;
        say('contact.fbSending', null);

        fetch('https://formsubmit.co/ajax/' + FB_TO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            message: body,
            email: mailBox.value.trim() || '(not given)',
            page_language: I18N ? I18N.current : 'en',
            _subject: 'alphaff.gg - site feedback',
            _template: 'table'
          })
        })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (result) { if (result.success !== true && result.success !== 'true') throw new Error('Submission rejected'); form.reset(); say('contact.fbOk', true); })
        .catch(function () { say('contact.fbErr', false); })
        .then(function () { btn.disabled = false; });
      });
    })();

    if (I18N) I18N.init();
    applySettings();
    buildLangGrid();

    loadPresets();
    loadStoreExtras();

    function route() {
      let parts;
      try { parts = decodeURIComponent(location.hash.slice(1)).split('/'); } catch (e) { parts = ['home']; }
      showPanel(parts[0] || 'home', false);
      if (parts[0] === 'models' && parts[1]) selectModel(parts.slice(1).join('/'), false, false);
    }
    window.addEventListener('popstate', route);
    window.addEventListener('hashchange', route);
    function refreshCatalog() { return loadManifest().then(() => { renderPicker(); renderStore(); route(); }); }
    document.getElementById('catalogRetry').addEventListener('click', refreshCatalog);
    document.getElementById('storeRetry').addEventListener('click', loadStoreExtras);
    refreshCatalog();
    tabs.forEach(tab => tab.addEventListener('keydown', e => {
      const visible = tabs.filter(x => !x.hidden);
      let index = visible.indexOf(tab);
      if (e.key === 'Home') index = 0;
      else if (e.key === 'End') index = visible.length - 1;
      else if (e.key === 'ArrowRight') index += document.documentElement.dir === 'rtl' ? -1 : 1;
      else if (e.key === 'ArrowLeft') index += document.documentElement.dir === 'rtl' ? 1 : -1;
      else return;
      e.preventDefault();
      const next = visible[(index + visible.length) % visible.length];
      next.focus(); showPanel(next.id.replace('tab-', ''));
    }));
    // Contain focus and disable background interaction for every overlay.
    let focusOverlay = null, focusReturn = null;
    const inerted = [];
    function syncOverlay() {
      const next = !lb.hidden ? lb : !modal.hidden ? modal : !drawer.hidden ? drawer : isExpanded() ? stage : null;
      if (next === focusOverlay) return;
      inerted.splice(0).forEach(el => { el.inert = false; });
      if (next) {
        let node = next;
        while (node.parentElement && node !== document.body) {
          Array.from(node.parentElement.children).forEach(el => {
            if (el !== node && !el.inert && !el.matches('script,style,.modal-backdrop,.drawer-backdrop')) { el.inert = true; inerted.push(el); }
          });
          node = node.parentElement;
        }
      } else if (focusReturn && focusReturn.isConnected) {
        (focusReturn.closest('[hidden]') ? menuBtn : focusReturn).focus();
      }
      focusOverlay = next;
    }
    [lb, modal, drawer, stage].forEach(el => new MutationObserver(syncOverlay).observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] }));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !focusOverlay) return;
      const items = Array.from(focusOverlay.querySelectorAll('button, a[href], input, [tabindex="0"]')).filter(el => !el.disabled && el.getClientRects().length && !el.closest('[hidden]'));
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !focusOverlay.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !focusOverlay.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    });

    sizeLibrary();
    window.setTimeout(sizeLibrary, 300);

    document.getElementById('year').textContent = new Date().getFullYear();
  })();
