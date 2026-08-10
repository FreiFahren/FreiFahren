#!/usr/bin/env bun
/*
 * Encrypt and decrypt the trust-flag definitions. See the README for the workflow.
 *
 * Committed encrypted because publishing `client-burst-10m` publishes the number 4, and the evasion
 * is to file 3. Recipients are resolved from the repo's collaborators at encrypt time rather than
 * committed, so access follows membership with no list to maintain.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { trustFlagSchema } from './modules/reports/trust'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLAINTEXT_PATH = join(packageRoot, 'trust-flags.json')
const CIPHERTEXT_PATH = join(packageRoot, 'trust-flags.enc')
// The deploy is not a GitHub user; its private half is the TRUST_FLAGS_AGE_KEY repository secret.
const CI_RECIPIENT_PATH = join(packageRoot, 'trust-flags.ci.pub')

const run = (command: string, args: string[], options: { input?: string } = {}): string => {
    try {
        return execFileSync(command, args, { encoding: 'utf8', input: options.input })
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`\`${command} ${args.join(' ')}\` failed: ${detail}`)
    }
}

// Without this the failure is a raw ENOENT, which reads as a bug in this script.
const requireTools = (...tools: string[]) => {
    for (const tool of tools) {
        try {
            execFileSync('which', [tool], { stdio: 'ignore' })
        } catch {
            const hint = tool === 'age' ? '`brew install age`' : 'https://cli.github.com'
            throw new Error(`\`${tool}\` is not installed (${hint}).`)
        }
    }
}

// Every collaborator regardless of permission: reading the repo already shows how the flags are used.
const collaborators = (): string[] =>
    run('gh', ['api', 'repos/:owner/:repo/collaborators', '--paginate', '--jq', '.[].login'])
        .split('\n')
        .map((login) => login.trim())
        .filter((login) => login !== '')

// Key types age accepts; anything else on a profile is skipped rather than failing the encrypt.
const sshKeysFor = async (login: string): Promise<string[]> => {
    const response = await fetch(`https://github.com/${login}.keys`)
    if (!response.ok) return []
    return (await response.text())
        .split('\n')
        .map((key) => key.trim())
        .filter((key) => key.startsWith('ssh-ed25519 ') || key.startsWith('ssh-rsa '))
}

const resolveRecipients = async (): Promise<{ args: string[]; readers: string[]; skipped: string[] }> => {
    const args: string[] = []
    const readers: string[] = []
    const skipped: string[] = []

    for (const login of collaborators()) {
        const keys = await sshKeysFor(login)
        if (keys.length === 0) {
            skipped.push(login)
            continue
        }
        readers.push(login)
        for (const key of keys) args.push('-r', key)
    }

    return { args, readers, skipped }
}

const describeAccess = ({ readers, skipped }: { readers: string[]; skipped: string[] }) => {
    console.log(`Readable by: ${readers.join(', ')}, and the deploy.`)
    if (skipped.length > 0) {
        console.warn(
            `Not readable by ${skipped.join(', ')} — no SSH key on their GitHub profile. They can add one under ` +
                'Settings -> SSH and GPG keys; re-run `bun run flags:encrypt` afterwards.'
        )
    }
}

// A set the Worker would reject must not reach a commit. Strict where the Worker is lenient, so an
// unknown key is an error naming it rather than a field the next round trip silently drops.
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

// Identities are read from a path, not stdin, so CI's has to touch disk briefly.
const decryptWithEnvIdentity = (identity: string): string => {
    const directory = mkdtempSync(join(tmpdir(), 'trust-flags-'))
    const identityPath = join(directory, 'identity')
    try {
        writeFileSync(identityPath, identity.endsWith('\n') ? identity : `${identity}\n`, { mode: 0o600 })
        return run('age', ['-d', '-i', identityPath, CIPHERTEXT_PATH])
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}

const SSH_IDENTITIES = ['id_ed25519', 'id_rsa']

// A key file age cannot find by convention — a custom filename, or one only the agent holds.
const identityOverride = (): string[] => {
    const path = process.env.TRUST_FLAGS_AGE_IDENTITY
    return path !== undefined && path !== '' ? [path] : []
}

const decrypt = (): string => {
    const fromEnvironment = process.env.TRUST_FLAGS_AGE_KEY
    if (fromEnvironment !== undefined && fromEnvironment !== '') return decryptWithEnvIdentity(fromEnvironment)

    const home = process.env.HOME ?? ''
    const searched = [...identityOverride(), ...SSH_IDENTITIES.map((name) => join(home, '.ssh', name))]
    const candidates = searched.filter((path) => existsSync(path))
    if (candidates.length === 0) {
        throw new Error(
            `No key file at ${searched.join(' or ')}. Decryption uses the key you push with, and its public half ` +
                'has to be on your GitHub profile — add one there, then ask anyone with access to re-run ' +
                '`bun run flags:encrypt`. Point TRUST_FLAGS_AGE_IDENTITY at the file if your key lives elsewhere.'
        )
    }

    const failures: string[] = []
    for (const identity of candidates) {
        try {
            return run('age', ['-d', '-i', identity, CIPHERTEXT_PATH])
        } catch (error) {
            failures.push(`${identity}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
        }
    }
    throw new Error(
        "None of your SSH keys can read this file. It is encrypted to the keys published by this repo's " +
            'collaborators, so if you joined recently, ask anyone with access to re-run `bun run flags:encrypt`.\n' +
            failures.join('\n')
    )
}

const main = async () => {
    const mode = process.argv[2]

    if (mode === 'decrypt') {
        requireTools('age')
        writeFileSync(PLAINTEXT_PATH, `${JSON.stringify(parseFlags(decrypt()), null, 4)}\n`)
        console.log(`Wrote ${PLAINTEXT_PATH} — gitignored. Edit it, then run \`bun run flags:encrypt\`.`)
        return
    }

    // Needs only gh, so it answers "who can read this?" without age installed.
    if (mode === 'recipients') {
        requireTools('gh')
        describeAccess(await resolveRecipients())
        return
    }

    if (mode === 'encrypt') {
        requireTools('age', 'gh')
        if (!existsSync(PLAINTEXT_PATH)) throw new Error(`No ${PLAINTEXT_PATH} — run \`bun run flags:decrypt\` first.`)
        if (!existsSync(CI_RECIPIENT_PATH)) {
            throw new Error(
                `No ${CI_RECIPIENT_PATH}. Generate the deploy identity once with \`age-keygen -o ci.key\`, put the ` +
                    'private key in the TRUST_FLAGS_AGE_KEY repository secret, and commit the public half here.'
            )
        }

        const recipients = await resolveRecipients()
        if (recipients.readers.length === 0) {
            throw new Error('No collaborator publishes an SSH key — refusing to encrypt to the deploy alone.')
        }

        const flags = parseFlags(readFileSync(PLAINTEXT_PATH, 'utf8'))
        // Checked here too, so the ceiling is hit by whoever edits the set, not by the deploy.
        asSecretValue(flags)
        const args = [...recipients.args, '-R', CI_RECIPIENT_PATH]
        writeFileSync(CIPHERTEXT_PATH, run('age', ['-e', '-a', ...args], { input: JSON.stringify(flags, null, 4) }))
        console.log(`Wrote ${CIPHERTEXT_PATH} — commit this.`)
        describeAccess(recipients)
        return
    }

    // Deploy workflow: plaintext to stdout, never to the runner's disk, and compact to save bytes.
    if (mode === 'print') {
        requireTools('age')
        process.stdout.write(asSecretValue(parseFlags(decrypt())))
        return
    }

    throw new Error('Usage: trust-flags.ts <decrypt|encrypt|recipients|print>')
}

// Failures here are operator-facing, and a stack trace buries the sentence that says what to do.
await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
