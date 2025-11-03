import { Hono } from 'hono'
import { type Env } from 'app.type';

const app = new Hono<Env>()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app
