import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { ROOT, LANGUAGE, readDictionaries, renderClient } from '../scripts/build.mjs'
import { compare, placeholders } from '../scripts/check.mjs'
import { extractAll } from '../scripts/extract.mjs'

const clientSource = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')
const baseline = JSON.parse(readFileSync(join(ROOT, 'data', 'en.json'), 'utf8'))

/** Load lib/client.js the way dsh's ModuleLoader does, with a recording ctx.
 * `taken`: the language is already registered by another plugin. */
function loadClient({ taken = false } = {}) {
  let entry
  const warnings = []
  // No fetch, storage, XHR or WebSocket in the sandbox: touching one throws.
  const sandbox = { window: { __ModuleLoader__: { load(e) { entry = e } } }, console: { warn: (m) => warnings.push(m) } }
  vm.createContext(sandbox)
  vm.runInContext(clientSource, sandbox)
  const plugin = entry.factory()
  const calls = { languages: [], registrations: [], effects: 0, warnings }
  const ctx = {
    effect(fn, label) { calls.effects++; assert.match(label, /^dsh-locale-pt-br: /); return fn() },
    locale: {
      addLanguage(def) {
        // dsh's own message for a duplicate definition.
        if (taken) throw new Error(`locale "${def.id}" is already registered`)
        calls.languages.push(def)
        return () => {}
      },
      register(ns, lang, dict) { calls.registrations.push({ ns, lang, dict }); return () => {} },
    },
  }
  plugin.apply(ctx)
  return { entry, plugin, calls }
}

test('lib/client.js is generated from the dictionaries', () => {
  assert.equal(clientSource, renderClient(readDictionaries()))
})

test('the bundle registers pt-BR and every namespace, each as an owned effect', () => {
  const { entry, plugin, calls } = loadClient()
  assert.equal(entry.id, 'dsh-locale-pt-br')
  assert.deepEqual([...plugin.inject], ['locale'])
  assert.deepEqual(calls.languages.map((l) => ({ ...l })), [{ id: 'pt-BR', label: 'Português (Brasil)', fallback: 'en' }])
  const dictionaries = readDictionaries()
  assert.deepEqual(calls.registrations.map((r) => r.ns), Object.keys(dictionaries))
  for (const r of calls.registrations) assert.equal(r.lang, 'pt-BR')
  assert.equal(calls.effects, 1 + calls.registrations.length)
})

test('another plugin already providing pt-BR leaves this pack inactive, not failed', () => {
  const { calls } = loadClient({ taken: true })
  assert.deepEqual(calls.languages, [])
  assert.deepEqual(calls.registrations, [])
  assert.equal(calls.effects, 1)
  assert.equal(calls.warnings.length, 1)
  assert.match(calls.warnings[0], /already provides pt-BR/)
})

test('every English string of the pinned dsh has a pt-BR translation', () => {
  const report = compare(baseline.namespaces, readDictionaries(undefined, { keepEmpty: true }))
  assert.deepEqual(report.missing, [])
  assert.deepEqual(report.stale, [])
  assert.deepEqual(report.empty, [])
  assert.deepEqual(report.placeholderMismatch, [])
})

test('placeholders are compared as sets of names', () => {
  assert.deepEqual(placeholders('Linha {line}, coluna {column}'), ['column', 'line'])
  assert.deepEqual(placeholders('sem marcadores'), [])
  const en = { ns: { a: '{count} files', b: 'Hi' } }
  assert.deepEqual(compare(en, { ns: { a: '{total} arquivos', b: 'Oi' } }).placeholderMismatch, ['ns:a'])
  assert.deepEqual(compare(en, { ns: { a: '{count} arquivos', b: 'Oi', c: 'x' } }).stale, ['ns:c'])
  assert.deepEqual(compare(en, { ns: { a: '{count} arquivos' } }).missing, ['ns:b'])
  // An empty English string needs no translation.
  assert.equal(compare({ ns: { a: '' } }, { ns: {} }).missing.length, 0)
})

test('the language id is a BCP 47 tag whose primary subtag is pt', () => {
  // dsh picks a browser language by exact tag, then by primary subtag, so
  // pt-BR, pt-PT and plain pt browsers all get this pack.
  assert.match(LANGUAGE.id, /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
  assert.equal(LANGUAGE.id.toLowerCase().split('-')[0], 'pt')
  assert.equal(LANGUAGE.fallback, 'en')
})

test('package.json declares a web client plugin with the bundle patch', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.deepEqual(pkg.dsh.client.inject, ['@deepseek-ai/dsh-client-locale'])
  assert.equal(pkg.exports['./client'].default, './lib/client.js')
  for (const f of ['index.js', 'lib/client.js', 'cordis.patch.yml']) {
    assert.ok(pkg.files.includes(f), `${f} is published`)
    assert.ok(existsSync(join(ROOT, f)), `${f} exists`)
  }
})

// Needs a dsh install: DSH_NODE_MODULES=<dir holding @deepseek-ai> npm test
const dshModules = process.env.DSH_NODE_MODULES
test('the baseline matches the dsh install (DSH_NODE_MODULES)', { skip: !dshModules && 'DSH_NODE_MODULES not set' }, async () => {
  const live = await extractAll(dshModules)
  assert.deepEqual(live.problems, [])
  if (live.dshVersion === baseline.dshVersion) assert.deepEqual(live.namespaces, baseline.namespaces)
  const report = compare(live.namespaces, readDictionaries(undefined, { keepEmpty: true }))
  assert.deepEqual(report.missing, [], `dsh ${live.dshVersion} has strings without a translation`)
})

test('dsh selects pt-BR for pt-BR, pt-PT and pt browsers (DSH_NODE_MODULES)', { skip: !dshModules && 'DSH_NODE_MODULES not set' }, () => {
  // Run dsh's own detectBrowserLocale and localeKey from the installed bundle.
  const source = readFileSync(join(dshModules, '@deepseek-ai', 'dsh-client-locale', 'lib', 'client.js'), 'utf8')
  const grab = (name) => {
    const start = source.indexOf(`function ${name}(`)
    assert.notEqual(start, -1, `${name} not found in dsh-client-locale`)
    let depth = 0
    for (let i = source.indexOf('{', start); i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1)
    }
    throw new Error(`unbalanced ${name}`)
  }
  const detect = vm.runInNewContext(`${grab('localeKey')}\n${grab('detectBrowserLocale')}\ndetectBrowserLocale`, { window: {} })
  const locales = [{ id: 'zh' }, { id: 'en' }, { id: LANGUAGE.id }]
  for (const tag of ['pt-BR', 'pt-br', 'pt-PT', 'pt']) assert.equal(detect(locales, [tag]), 'pt-BR', tag)
  assert.equal(detect(locales, ['en-US']), 'en')
})
