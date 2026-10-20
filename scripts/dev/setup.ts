import { env } from './env'
import { install } from './install'
import { AUTH_WORKER, exists, FUND, run } from './paths'
import { seed } from './seed'

await install()
env()
await seed()
if (exists(AUTH_WORKER)) await run(AUTH_WORKER, ['bun', 'run', 'db:migrate'])
if (exists(FUND)) await run(FUND, ['bun', 'run', 'db:migrate'])
