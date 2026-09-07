import { pathToFileURL } from 'node:url'

export async function cleanupPreviews({ env = process.env, fetchImpl = fetch, log = console.log } = {}) {
    for (const key of ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
        if (!env[key]) throw new Error(`Missing ${key}`)
    }
    const dryRun = env.DRY_RUN === 'true'
    const githubBase = `${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}`
    const cloudflareBase = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}`
    const request = async (provider, path, { method = 'GET', body, missing = false } = {}) => {
        const cf = provider === 'cloudflare'
        const response = await fetchImpl(`${cf ? cloudflareBase : githubBase}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${cf ? env.CLOUDFLARE_API_TOKEN : env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                ...(cf ? {} : { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(30_000),
        })
        const data = await response.json()
        const missingWorker =
            cf &&
            path.startsWith('/workers/scripts/') &&
            data.errors?.some(({ code }) => code === 10007 || code === 10090)
        if (missing && (response.status === 404 || missingWorker)) return null
        if (!response.ok || (cf && data.success !== true)) {
            throw new Error(`${provider} ${method} ${path} failed (${response.status})`)
        }
        return cf ? data.result : data
    }
    const list = async (provider, path) => {
        const entries = []
        for (let page = 1; ; page++) {
            const batch = await request(provider, `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
            if (!Array.isArray(batch)) throw new Error(`Invalid inventory: ${path}`)
            entries.push(...batch)
            if (batch.length < 100) return entries
        }
    }

    // Finish every inventory before deleting anything; an API failure is never an empty open-PR list.
    const openPRs = new Set((await list('github', '/pulls?state=open')).map(({ number }) => String(number)))
    // Workers scripts is a single-page API, unlike D1 and GitHub's list endpoints.
    const workers = await request('cloudflare', '/workers/scripts')
    if (!Array.isArray(workers)) throw new Error('Invalid Worker inventory')
    const databases = await list('cloudflare', '/d1/database')
    const deployments = await list('github', '/deployments')
    const candidates = new Map()
    const add = (pr, type, resource) => {
        if (!pr || openPRs.has(pr)) return
        if (!candidates.has(pr)) candidates.set(pr, { workers: [], databases: [], deployments: [] })
        if (type) candidates.get(pr)[type].push(resource)
    }
    for (const worker of workers) add(/^(?:api|frontend)-pr-([1-9]\d*)$/.exec(worker.id)?.[1], 'workers', worker)
    // Keep the preview namespace but allow old city names, including cities removed from the registry.
    for (const database of databases) {
        add(/^api-worker-db(?:-[a-z0-9]+)*-pr-([1-9]\d*)$/.exec(database.name)?.[1], 'databases', database)
    }
    for (const deployment of deployments) {
        if (deployment.transient_environment && !deployment.production_environment) {
            add(/^pr-([1-9]\d*)$/.exec(deployment.environment)?.[1], 'deployments', deployment)
        }
    }
    if (/^[1-9]\d*$/.test(env.PR_NUMBER || '')) add(env.PR_NUMBER)

    const failures = []
    for (const [pr, resources] of candidates) {
        try {
            // The PR may have reopened since inventory. Do not trust the original close event either.
            const pull = await request('github', `/pulls/${pr}`, { missing: true })
            if (pull?.state === 'open') {
                log(`Keeping reopened PR #${pr}`)
                continue
            }
            if (pull && pull.state !== 'closed') throw new Error(`Unexpected PR state for #${pr}`)
            log(
                `${dryRun ? 'Would clean' : 'Cleaning'} PR #${pr}: ${resources.workers.length} workers, ${resources.databases.length} databases, ${resources.deployments.length} deployments`
            )
            if (dryRun) continue
            for (const { id } of resources.workers) {
                await request('cloudflare', `/workers/scripts/${encodeURIComponent(id)}?force=true`, {
                    method: 'DELETE',
                    missing: true,
                })
                log(`Deleted Worker ${id}`)
            }
            for (const { uuid, name } of resources.databases) {
                await request('cloudflare', `/d1/database/${encodeURIComponent(uuid)}`, {
                    method: 'DELETE',
                    missing: true,
                })
                log(`Deleted database ${name}`)
            }
            // Retire links only after teardown succeeds; include deployment-only leftovers on retries.
            for (const { id } of resources.deployments) {
                const statuses = await request('github', `/deployments/${id}/statuses?per_page=1`)
                if (statuses[0]?.state === 'inactive') continue
                await request('github', `/deployments/${id}/statuses`, {
                    method: 'POST',
                    body: { state: 'inactive', auto_inactive: false },
                })
            }
        } catch (error) {
            failures.push(error)
            log(`PR #${pr}: ${error.message}`)
        }
    }
    if (failures.length) throw new AggregateError(failures, `Cleanup failed for ${failures.length} PR(s)`)
    log(`${dryRun ? 'Dry run' : 'Cleanup'} complete`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    cleanupPreviews().catch((error) => {
        console.error(error.message)
        process.exitCode = 1
    })
}
