#!/usr/bin/env bun
/*
 * Validate and print the trust-flag definitions. See the README for the workflow.
 *
 * The definitions live in `trust-flags.json`, committed in plain text: the repo is private, so
 * the thresholds (`client-burst-10m` publishing the number 4, and the evasion being to file 3)
 * are only visible to people who can already read how the flags are evaluated. If the repo ever
 * goes public, re-introduce the age encryption this file carried before that decision.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isCitySlug } from '@freifahren/cities'
import { z } from 'zod'

import { trustFlagSchema } from './modules/reports/trust'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const FLAGS_PATH = join(packageRoot, 'trust-flags.json')

/*
 * A set the Worker would reject must not reach a commit. Strict where the Worker is lenient, so an
 * unknown key is an error naming it rather than a field the next round trip silently drops.
 */
const parseFlags = (json: string) => {
    let decoded: unknown
    try {
        decoded = JSON.parse(json)
    } catch (error) {
        throw new Error(`Not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    }

    const parsed = z.array(trustFlagSchema.strict()).safeParse(decoded)
    if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => `flag ${issue.path.join('.') || '?'}: ${issue.message}`)
        throw new Error(`Not a valid flag set:\n${issues.join('\n')}`)
    }
    const flags = parsed.data
    const ids = flags.map((flag) => flag.id)
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    if (duplicates.length > 0) throw new Error(`Duplicate flag ids: ${duplicates.join(', ')}`)
    const unknown = flags.flatMap((flag) => (flag.cities ?? []).filter((slug) => !isCitySlug(slug)))
    if (unknown.length > 0) {
        throw new Error(`Unknown city slug(s) in flag cities: ${[...new Set(unknown)].join(', ')}`)
    }
    return flags
}

// Cloudflare caps a plain-text binding at 5 KB, and reports the overflow as the opaque error 10054.
const SECRET_LIMIT_BYTES = 5120

const asSecretValue = (flags: unknown[]): string => {
    const value = JSON.stringify(flags)
    const bytes = Buffer.byteLength(value)
    if (bytes > SECRET_LIMIT_BYTES) {
        throw new Error(
            `The flag set serialises to ${bytes} bytes; a Worker secret holds ${SECRET_LIMIT_BYTES}. ` +
                'Shorten the descriptions, or drop a flag that has stopped earning its place.'
        )
    }
    if (bytes > SECRET_LIMIT_BYTES * 0.9) {
        console.warn(`Warning: ${bytes} of ${SECRET_LIMIT_BYTES} bytes used — another flag will not fit.`)
    }
    return value
}

const readFlags = () => {
    if (!existsSync(FLAGS_PATH)) throw new Error(`No ${FLAGS_PATH} — it is committed; check the working tree.`)
    return parseFlags(readFileSync(FLAGS_PATH, 'utf8'))
}

const main = () => {
    const mode = process.argv[2]

    // The pre-commit sanity check: schema, duplicate ids, and the secret size ceiling.
    if (mode === 'check') {
        asSecretValue(readFlags())
        console.log(`${FLAGS_PATH} is a valid flag set.`)
        return
    }

    // Deploy workflow: compact to stdout for `wrangler secret put`.
    if (mode === 'print') {
        process.stdout.write(asSecretValue(readFlags()))
        return
    }

    throw new Error('Usage: trust-flags.ts <check|print>')
}

// Failures here are operator-facing, and a stack trace buries the sentence that says what to do.
try {
    main()
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
}
