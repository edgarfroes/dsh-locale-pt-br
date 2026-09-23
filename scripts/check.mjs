#!/usr/bin/env node
// Compare the pt-BR dictionaries with dsh's English strings.
//
// Usage:
//   node scripts/check.mjs                  against data/en.json (the pinned dsh)
//   node scripts/check.mjs --dsh <dir>      against a dsh install (<dir> holds @deepseek-ai)
//   add --json for a machine-readable report.
// Exit 1 when a key is missing, stale or empty, or its {placeholders} differ.

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ROOT, readDictionaries } from './build.mjs'
import { extractAll } from './extract.mjs'

/** @param {string} text */
export function placeholders(text) {
  return [...text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).sort()
}

/**
 * @param {Record<string, Record<string, string>>} en
 * @param {Record<string, Record<string, string>>} pt
 */
export function compare(en, pt) {
  const missing = []
  const stale = []
  const empty = []
  const placeholderMismatch = []
  for (const [ns, dict] of Object.entries(en)) {
    for (const [key, source] of Object.entries(dict)) {
      // An empty English string (a layout slot such as a shared prefix) needs
      // no translation: the English fallback is already right.
      if (source === '') continue
      const text = pt[ns]?.[key]
      if (text === undefined) { missing.push(`${ns}:${key}`); continue }
      if (text.trim() === '') { empty.push(`${ns}:${key}`); continue }
      if (placeholders(source).join('|') !== placeholders(text).join('|')) placeholderMismatch.push(`${ns}:${key}`)
    }
  }
  for (const [ns, dict] of Object.entries(pt)) {
    for (const key of Object.keys(dict)) if (en[ns]?.[key] === undefined) stale.push(`${ns}:${key}`)
  }
  const total = Object.values(en).reduce((n, d) => n + Object.values(d).filter((s) => s !== '').length, 0)
  return { total, translated: total - missing.length, missing, stale, empty, placeholderMismatch }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const at = args.indexOf('--dsh')
  let en, dshVersion
  if (at !== -1) {
    const result = await extractAll(resolve(args[at + 1] ?? ''))
    en = result.namespaces
    dshVersion = result.dshVersion
  } else {
    const baseline = JSON.parse(readFileSync(join(ROOT, 'data', 'en.json'), 'utf8'))
    en = baseline.namespaces
    dshVersion = baseline.dshVersion
  }
  const report = { dshVersion, ...compare(en, readDictionaries(undefined, { keepEmpty: true })) }
  const failed = report.missing.length + report.stale.length + report.empty.length + report.placeholderMismatch.length > 0
  if (json) {
    console.log(JSON.stringify({ ok: !failed, ...report }, null, 2))
  } else {
    console.log(`dsh ${dshVersion}: ${report.translated}/${report.total} strings translated`)
    for (const name of ['missing', 'stale', 'empty', 'placeholderMismatch']) {
      const list = report[name]
      if (list.length) console.log(`${name} (${list.length}): ${list.slice(0, 20).join(', ')}${list.length > 20 ? ', …' : ''}`)
    }
  }
  process.exit(failed ? 1 : 0)
}
