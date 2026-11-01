import { readFileSync, writeFileSync } from 'node:fs'

const runNumber = Number(process.argv[2])
if (!Number.isInteger(runNumber) || runNumber < 1 || runNumber > 65535) {
  throw new Error('GitHub run number must be between 1 and 65535')
}

const path = 'dist/manifest.json'
const manifest = JSON.parse(readFileSync(path, 'utf8'))
const baseVersion = manifest.version
const parts = baseVersion.split('.')
if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part) || Number(part) > 65535)) {
  throw new Error(`Expected a one to three part numeric manifest version, got ${baseVersion}`)
}

manifest.version = `${baseVersion}.${runNumber}`
manifest.version_name = baseVersion
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Chrome Web Store package version: ${manifest.version}`)
