#!/usr/bin/env node
// Extract every English namespace dictionary a dsh install ships.
//
// dsh's client packages register their copy with
// `ctx.locale.register(ns, { zh, en })` inside their browser bundle
// (`lib/client.js`). This script loads each bundle in a Node `vm` sandbox with
// stand-in browser globals and a stand-in `ctx`, runs its `apply`, and records
// those calls. Nothing is rendered and nothing touches the network.
//
// Usage: node scripts/extract.mjs <node_modules dir that holds @deepseek-ai> [out.json]
// Prints a summary; writes { dshVersion, namespaces: { ns: { key: en } } }.

import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import vm from 'node:vm'

let protoStandIn = null

/** A value that accepts any property read, call or `new` and returns itself. */
function anything(overrides = {}) {
  const target = function () {}
  const proxy = new Proxy(target, {
    get(_, prop) {
      if (prop in overrides) return overrides[prop]
      if (prop === Symbol.toPrimitive) return () => ''
      if (prop === Symbol.iterator) return function* () {}
      if (prop === Symbol.asyncIterator) return async function* () {}
      if (prop === 'then') return undefined
      if (prop === 'length') return 0
      if (typeof prop === 'symbol') return undefined
      return anything()
    },
    apply() { return anything() },
    construct() { return anything() },
    has() { return true },
    // Bundles copy imports through `Object.create(Object.getPrototypeOf(mod))`;
    // a stand-in prototype keeps every named import resolvable after the copy.
    getPrototypeOf() { return protoStandIn },
    set() { return true },
  })
  return proxy
}

protoStandIn = anything()

/**
 * Run one bundle and collect its `en` dictionaries.
 * @param {string} file @returns {Promise<{ id: string, dictionaries: Map<string, Record<string,string>>, errors: string[] }>}
 */
export async function extractBundle(file) {
  const dictionaries = new Map()
  const errors = []
  let loaded
  const locale = anything({
    register(ns, second, third) {
      // Shipped packages: register(ns, { zh, en }). Language packs: register(ns, lang, dict).
      const en = typeof second === 'string' ? (second === 'en' ? third : undefined) : second?.en
      if (typeof ns === 'string' && en && typeof en === 'object') {
        dictionaries.set(ns, { ...(dictionaries.get(ns) ?? {}), ...en })
      }
      return () => {}
    },
    bind: () => (key) => String(key),
    addLanguage: () => () => {},
  })
  const seen = new Set()
  const pending = []
  const runPlugin = (plugin, ctx) => {
    if (!plugin || seen.has(plugin)) return
    seen.add(plugin)
    const apply = typeof plugin === 'function' ? plugin : plugin.apply
    if (typeof apply !== 'function') return
    try {
      // An empty config: stand-in config values would reach code that
      // validates them (the theme registry does) and throw before registering.
      const out = apply.call(plugin, ctx, {})
      if (out && typeof out.then === 'function') pending.push(out.catch((e) => errors.push(String(e?.message ?? e))))
    } catch (e) { errors.push(String(e?.message ?? e)) }
  }
  const ctx = anything({
    locale,
    effect(fn) {
      try { const r = fn(); if (r && typeof r.catch === 'function') r.catch(() => {}) } catch (e) { errors.push(String(e?.message ?? e)) }
      return () => {}
    },
    plugin(p) { runPlugin(p, ctx); return anything() },
    // `ctx.inject(deps, fn)` runs `fn` once the services exist: run it now.
    inject(_deps, fn) {
      if (typeof fn === 'function') {
        try { const r = fn(ctx); if (r && typeof r.then === 'function') pending.push(r.catch(() => {})) } catch (e) { errors.push(String(e?.message ?? e)) }
      }
      return anything()
    },
    // Settings forms start empty, as on a fresh profile.
    configForms: anything({ get: () => anything({ getSnapshot: () => ({ value: undefined }), subscribe: () => () => {} }) }),
  })
  const window = anything({
    __ModuleLoader__: { load(entry) { loaded = entry } },
  })
  const capture = (ns, second, third) => locale.register(ns, second, third)
  const sandbox = {
    __dshCapture: capture,
    window, document: anything(), navigator: anything(), location: anything(), localStorage: anything(),
    matchMedia: anything(), getComputedStyle: anything(), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    HTMLElement: class {}, Element: class {}, Node: class {}, Event: class {}, CustomEvent: class {}, EventTarget: class {},
    ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, queueMicrotask: () => {},
    URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, structuredClone,
  }
  sandbox.globalThis = sandbox
  sandbox.self = sandbox
  vm.createContext(sandbox)
  try {
    // Route every `….locale.register(` / `locale.register(` call, including the
    // locale package's own registrations, to the recorder.
    const source = readFileSync(file, 'utf8').replace(/(?:[\w$]+\.)*locale\.register\(/g, '__dshCapture(')
    vm.runInContext(source, sandbox, { filename: file })
  } catch (e) { errors.push(`load: ${e?.message ?? e}`) }
  if (!loaded) return { id: file, dictionaries, errors: [...errors, 'no __ModuleLoader__.load call'] }
  let exports
  try { exports = loaded.factory(() => anything()) } catch (e) { errors.push(`factory: ${e?.message ?? e}`) }
  if (exports) runPlugin(exports, ctx)
  // Some plugins register from an async `apply`; stand-in awaits settle at once.
  await Promise.race([Promise.all(pending), new Promise((r) => { globalThis.setTimeout(r, 2000).unref?.() })])
  return { id: loaded.id, dictionaries, errors }
}

/** Bundles that register nothing in the web GUI by design. */
export const NOT_WEB = Object.freeze({
  '@deepseek-ai/dsh-client-ui-settings-account': 'Desktop renderer only',
})

/** @param {string} nodeModules */
export async function extractAll(nodeModules) {
  const scope = join(nodeModules, '@deepseek-ai')
  const namespaces = {}
  const sources = {}
  const problems = []
  for (const name of readdirSync(scope).sort()) {
    const file = join(scope, name, 'lib', 'client.js')
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    if (!text.includes('locale.register(')) continue
    const { id, dictionaries, errors } = await extractBundle(file)
    if (dictionaries.size === 0 && !(id in NOT_WEB)) problems.push({ id, errors: errors.slice(0, 3) })
    for (const [ns, dict] of dictionaries) {
      namespaces[ns] = { ...(namespaces[ns] ?? {}), ...dict }
      ;(sources[ns] ??= []).push(id)
    }
  }
  const dshPkg = join(scope, 'dsh', 'package.json')
  const dshVersion = existsSync(dshPkg) ? JSON.parse(readFileSync(dshPkg, 'utf8')).version : null
  return { dshVersion, namespaces: sortKeys(namespaces), sources, problems }
}

export function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]) ? sortKeys(obj[k]) : obj[k]]))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, out] = process.argv.slice(2)
  if (!dir) {
    console.error('usage: node scripts/extract.mjs <node_modules dir> [out.json]')
    process.exit(2)
  }
  const result = await extractAll(resolve(dir))
  const keys = Object.values(result.namespaces).reduce((n, d) => n + Object.keys(d).length, 0)
  console.log(`dsh ${result.dshVersion}: ${Object.keys(result.namespaces).length} namespaces, ${keys} keys`)
  for (const p of result.problems) console.log(`  no dictionary captured from ${p.id}: ${p.errors.join(' | ') || 'no error'}`)
  if (out) writeFileSync(out, JSON.stringify({ dshVersion: result.dshVersion, namespaces: result.namespaces }, null, 2) + '\n')
}
