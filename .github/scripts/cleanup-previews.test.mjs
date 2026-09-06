import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { cleanupPreviews } from './cleanup-previews.mjs'

const env = {
    GITHUB_TOKEN: 'github-test',
    GITHUB_REPOSITORY: 'test/repo',
    CLOUDFLARE_API_TOKEN: 'cloudflare-test',
    CLOUDFLARE_ACCOUNT_ID: 'account',
    PR_NUMBER: '2',
}

async function fixture(t, options = {}) {
    const workers = options.workers ?? [
        'api-pr-1',
        'frontend-pr-1',
        'api-pr-2',
        'frontend-pr-3',
        'api-worker',
        'frontend',
        'other-pr-2',
        'api-pr-2-backup',
    ]
    const databases = options.databases ?? [
        { name: 'api-worker-db-eu-pr-1', uuid: 'open' },
        { name: 'api-worker-db-old-city-pr-2', uuid: 'closed' },
        { name: 'api-worker-db-eu-pr-4', uuid: 'database-only' },
        { name: 'api-worker-db-eu', uuid: 'production' },
        { name: 'unrelated-pr-2', uuid: 'unrelated' },
    ]
    const deployments =
        options.deployments ??
        [1, 2, 3, 4, 5].map((id) => ({
            id,
            environment: `pr-${id}`,
            transient_environment: true,
            production_environment: false,
        }))
    const inactive = new Set()
    const requests = []
    const mutations = []
    const server = createServer(async (req, res) => {
        let raw = ''
        for await (const chunk of req) raw += chunk
        const url = new URL(req.url, 'http://localhost')
        const path = url.pathname.replace(/^\/client\/v4\/accounts\/account|^\/repos\/test\/repo/, '')
        requests.push(`${req.method} ${path}${url.search}`)
        const cf = req.url.startsWith('/client/')
        assert.equal(req.headers.authorization, `Bearer ${cf ? env.CLOUDFLARE_API_TOKEN : env.GITHUB_TOKEN}`)
        const send = (data, status = 200) => {
            res.writeHead(status, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(cf ? { success: status < 400, result: data } : data))
        }
        if (options.fail?.(req.method, path, url)) return send({}, 503)
        const page = (values) => {
            const offset = (Number(url.searchParams.get('page') || 1) - 1) * 100
            return values.slice(offset, offset + 100)
        }
        if (req.method === 'GET') {
            if (path === '/pulls') return send(page(options.open ?? [{ number: 1 }]))
            if (path.startsWith('/pulls/')) {
                const number = Number(path.split('/').at(-1))
                if (options.missingPR === number) return send({}, 404)
                return send({ state: options.reopened === number ? 'open' : 'closed' })
            }
            if (path === '/workers/scripts') return send(workers.map((id) => ({ id })))
            if (path === '/d1/database') return send(page(databases))
            if (path === '/deployments') return send(page(deployments))
            if (/^\/deployments\/\d+\/statuses$/.test(path))
                return send([{ state: inactive.has(Number(path.split('/')[2])) ? 'inactive' : 'success' }])
        }
        mutations.push(`${req.method} ${path}`)
        if (req.method === 'DELETE' && path.startsWith('/workers/scripts/')) {
            const index = workers.indexOf(path.split('/').at(-1))
            assert.equal(url.searchParams.get('force'), 'true')
            if (index < 0 || options.missingWorker) return send({}, 404)
            workers.splice(index, 1)
            return send(null)
        }
        if (req.method === 'DELETE' && path.startsWith('/d1/database/')) {
            const index = databases.findIndex((db) => db.uuid === path.split('/').at(-1))
            assert.ok(index >= 0)
            databases.splice(index, 1)
            return send(null)
        }
        if (req.method === 'POST' && path.endsWith('/statuses')) {
            assert.deepEqual(JSON.parse(raw), { state: 'inactive', auto_inactive: false })
            inactive.add(Number(path.split('/')[2]))
            return send({})
        }
        send({}, 404)
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise((resolve) => server.close(resolve)))
    const run = (extra = {}) =>
        cleanupPreviews({
            env: { ...env, ...extra },
            log: () => {},
            fetchImpl: (url, init) =>
                fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}${new URL(url).search}`, init),
        })
    return { run, workers, databases, inactive, requests, mutations }
}

test('sweeps closed, merged, missing, database-only and deployment-only previews; preserves open and unrelated resources; reruns idempotently', async (t) => {
    const f = await fixture(t, { missingPR: 3 })
    await f.run()
    assert.deepEqual(f.workers, [
        'api-pr-1',
        'frontend-pr-1',
        'api-worker',
        'frontend',
        'other-pr-2',
        'api-pr-2-backup',
    ])
    assert.deepEqual(
        f.databases.map((db) => db.uuid),
        ['open', 'production', 'unrelated']
    )
    assert.deepEqual([...f.inactive], [2, 3, 4, 5])
    assert.ok(f.mutations.indexOf('DELETE /d1/database/closed') < f.mutations.indexOf('POST /deployments/2/statuses'))
    const count = f.mutations.length
    await f.run()
    assert.equal(f.mutations.length, count)
})

test('dry run performs no mutations', async (t) => {
    const f = await fixture(t)
    await f.run({ DRY_RUN: 'true' })
    assert.deepEqual(f.mutations, [])
})

test('reopened PR, including the triggering PR, is retained', async (t) => {
    const f = await fixture(t, { reopened: 2 })
    await f.run()
    assert.ok(f.workers.includes('api-pr-2'))
    assert.ok(f.databases.some((db) => db.uuid === 'closed'))
    assert.ok(!f.inactive.has(2))
})

for (const failedPath of ['/pulls', '/workers/scripts', '/d1/database', '/deployments']) {
    test(`inventory failure at ${failedPath} prevents all deletes`, async (t) => {
        const f = await fixture(t, { fail: (_, path) => path === failedPath })
        await assert.rejects(f.run())
        assert.deepEqual(f.mutations, [])
    })
}

test('pagination retains open PRs on later pages and cleans later database/deployment pages', async (t) => {
    const f = await fixture(t, {
        open: Array.from({ length: 101 }, (_, i) => ({ number: i + 1 })),
        workers: ['api-pr-101', 'api-pr-200'],
        databases: Array.from({ length: 101 }, (_, i) => ({ name: `api-worker-db-city${i}-pr-200`, uuid: `db${i}` })),
        deployments: Array.from({ length: 101 }, (_, i) => ({
            id: i + 1,
            environment: 'pr-200',
            transient_environment: true,
            production_environment: false,
        })),
    })
    await f.run()
    assert.deepEqual(f.workers, ['api-pr-101'])
    assert.equal(f.databases.length, 0)
    assert.equal(f.inactive.size, 101)
})

test('failed teardown leaves its database/link intact, continues other PRs, and succeeds on retry', async (t) => {
    let fail = true
    const f = await fixture(t, {
        fail: (method, path) => fail && method === 'DELETE' && path === '/workers/scripts/api-pr-2',
    })
    await assert.rejects(f.run(), AggregateError)
    assert.ok(f.databases.some((db) => db.uuid === 'closed'))
    assert.ok(!f.inactive.has(2))
    assert.ok(f.inactive.has(3))
    fail = false
    await f.run()
    assert.ok(f.inactive.has(2))
})

test('GitHub recheck failure preserves candidate and reports failure', async (t) => {
    const f = await fixture(t, { fail: (_, path) => path === '/pulls/2' })
    await assert.rejects(f.run(), AggregateError)
    assert.ok(f.workers.includes('api-pr-2'))
    assert.ok(!f.inactive.has(2))
})

test('already missing worker is idempotent', async (t) => {
    const f = await fixture(t, { missingWorker: true })
    await f.run()
    assert.ok(f.inactive.has(2))
})

test('database deletion failure leaves deployment active and recovers after the worker is gone', async (t) => {
    let fail = true
    const f = await fixture(t, {
        fail: (method, path) => fail && method === 'DELETE' && path === '/d1/database/closed',
    })
    await assert.rejects(f.run(), AggregateError)
    assert.ok(!f.workers.includes('api-pr-2'))
    assert.ok(!f.inactive.has(2))
    fail = false
    await f.run()
    assert.ok(f.inactive.has(2))
})

test('deployment retirement failure is recovered after all Cloudflare resources are gone', async (t) => {
    let fail = true
    const f = await fixture(t, {
        fail: (method, path) => fail && method === 'POST' && path === '/deployments/2/statuses',
    })
    await assert.rejects(f.run(), AggregateError)
    assert.ok(!f.workers.includes('api-pr-2'))
    assert.ok(!f.databases.some((db) => db.uuid === 'closed'))
    fail = false
    await f.run()
    assert.ok(f.inactive.has(2))
})

test('a failed later open-PR page prevents all mutations', async (t) => {
    const f = await fixture(t, {
        open: Array.from({ length: 100 }, (_, i) => ({ number: i + 100 })),
        fail: (_, path, url) => path === '/pulls' && url.searchParams.get('page') === '2',
    })
    await assert.rejects(f.run())
    assert.deepEqual(f.mutations, [])
})
