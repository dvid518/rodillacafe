import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const source = path => readFileSync(new URL(path, root), 'utf8')
const ignored = new Set(source('.vercelignore').split(/\r?\n/))

for (const path of ['supabase/', 'sql/', 'work/', 'graphify-out/', 'scripts/', 'tests/', 'odd/', 'docs/', '*.bak', '.env*']) {
    test(`Vercel excludes ${path}`, () => assert.ok(ignored.has(path)))
}

const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0')
const publicSources = files.filter(path => /^(?:js\/|views\/|dashboard\/|[^/]+$)/.test(path) && /\.(?:html|m?js)$/.test(path))

test('deployable client sources have no direct Factiliza endpoint or historical key array', () => {
    for (const path of publicSources) {
        assert.ok(!/https?:\/\/api\.factiliza\.com\b|\bAPI_KEYS_DNI\b/i.test(source(path)), path)
    }
})

test('deployable client sources have no private key signatures; allow public anon JWT in config only', () => {
    for (const path of publicSources) {
        const body = source(path)
        assert.ok(!/sb_secret_[a-z\d_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(body), path)
        for (const token of body.matchAll(/\beyJ[\w-]+\.([\w-]+)\.[\w-]+\b/g)) {
            let role
            try { role = JSON.parse(Buffer.from(token[1], 'base64url')).role } catch { /* No public role. */ }
            assert.ok(path === 'js/config.js' && role === 'anon', path)
        }
    }
})
