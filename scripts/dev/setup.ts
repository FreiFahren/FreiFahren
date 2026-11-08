import { env } from './env'
import { install } from './install'
import { seed } from './seed'

await install()
env()
await seed()
