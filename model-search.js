(function () {
  'use strict';
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

    function rank(models, raw) {
      const q = String(raw || '').trim().toLowerCase();
      const searchable = models.filter(m => m.tier !== 'paid');
      if (!q) return { mode: 'all', items: searchable };

      const hits = searchable
        .map(function (m) { return { m: m, s: matchScore(q, m) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .map(function (x) { return x.m; });

      if (hits.length) return { mode: 'match', items: hits };

      const near = searchable
        .map(function (m) {
          return { m: m, d: Math.min(distance(q, String(m.name).toLowerCase()),
                                     distance(q, String(m.id).toLowerCase())) };
        })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 3)
        .map(function (x) { return x.m; });

      return { mode: 'closest', items: near };
    }

  window.AlphaModelSearch = { rank };
})();
