import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { StoryRequestSchema, type StoryRequest, type Inspector } from './models';
import { createImage } from './image';

const app = new Hono();

app.post('/instagram/stories', zValidator('json', StoryRequestSchema), async (c) => {
  const story: StoryRequest = c.req.valid('json');
  const inspector: Inspector = story;

  const imgBuffer = await createImage(inspector);

  // Save the image to a file
  const folderPath = './images';
  await Bun.write(`${folderPath}/story.png`, imgBuffer);

  return c.json({ status: 'success', message: 'Story image created successfully' });
});

export default {
  port: 8000,
  fetch: app.fetch,
};

console.log('Instagram Bot is running on port 8000');