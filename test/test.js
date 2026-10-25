'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const vt = require('vscode-textmate'), on = require('vscode-oniguruma');
const GRAMMAR = path.join(__dirname, '..', 'grammars', 'sounio.tmLanguage.json');
const FIX = path.join(__dirname, 'fixtures');
(async () => {
  await on.loadWASM(fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);
  const reg = new vt.Registry({
    onigLib: Promise.resolve({ createOnigScanner: p => new on.OnigScanner(p), createOnigString: s => new on.OnigString(s) }),
    loadGrammar: async () => vt.parseRawGrammar(fs.readFileSync(GRAMMAR, 'utf8'), GRAMMAR),
  });
  const g = await reg.loadGrammar('source.sounio');
  assert.ok(g, 'grammar loads');
  let failed = 0;
  const files = fs.readdirSync(FIX).filter(f => f.endsWith('.sio'));
  assert.ok(files.length > 0, 'fixtures present');
  for (const f of files) {
    let st = vt.INITIAL; const c = {};
    const lines = fs.readFileSync(path.join(FIX, f), 'utf8').split('\n');
    for (const l of lines) {
      const r = g.tokenizeLine(l, st); st = r.ruleStack;
      for (const t of r.tokens) { const s = t.scopes[t.scopes.length - 1].split('.').slice(0, 2).join('.'); c[s] = (c[s] || 0) + 1; }
    }
    const ok = c['keyword.control'] || c['keyword.other'] || c['storage.type'];
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${f} (${lines.length} lines) ${JSON.stringify(c)}`);
    if (!ok) failed++;
  }
  const line = 'let d: f64<m/s> = 500 <mg> + 24.0<h>; fn f(x: Knowledge<f64>) -> Vec<T> with IO, Panic { // c';
  const toks = g.tokenizeLine(line, vt.INITIAL).tokens.map(t => [line.slice(t.startIndex, t.endIndex), t.scopes.join(' ')]);
  const has = (txt, re) => toks.some(([s, sc]) => s.trim() === txt && re.test(sc));
  const checks = [['let', /keyword|storage/], ['fn', /keyword|storage/], ['c', /comment/], ['500', /constant\.numeric/], ['Knowledge', /type|support/]];
  for (const [txt, re] of checks) { const ok = has(txt, re); console.log(`${ok ? 'ok  ' : 'FAIL'} "${txt}" matches ${re}`); if (!ok) failed++; }
  if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
  console.log('all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
