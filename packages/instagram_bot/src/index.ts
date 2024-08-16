import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { StoryRequestSchema, type StoryRequest, type Inspector, type TokenResponse, type InstagramAccountResponse, type AccountsResponse } from './models';
import { createImage } from './image';
import fetch from 'node-fetch';

const app = new Hono();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SHORT_LIVED_ACCESS_TOKEN = process.env.SHORT_LIVED_ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID;

async function exchangeToken(shortLivedToken: string | undefined): Promise<string> {
  const response = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`);
  const data = await response.json() as TokenResponse;
  if (!data.access_token) {
    console.error('Token exchange failed:', data);
    throw new Error('Failed to exchange token');
  }
  return data.access_token;
}

async function getInstagramUserToken(longLivedToken: string): Promise<{ pageAccessToken: string; instagramAccountId: string }> {
  // Fetch the specific page data
  const pageResponse = await fetch(`https://graph.facebook.com/v20.0/${PAGE_ID}?fields=access_token,instagram_business_account&access_token=${longLivedToken}`);
  if (!pageResponse.ok) {
    const errorData = await pageResponse.json();
    console.error('Error fetching page data:', errorData);
    throw new Error(`Failed to fetch page data: ${pageResponse.status} ${pageResponse.statusText}`);
  }

  const pageData = await pageResponse.json();
  console.log('Page Data:', pageData);

  if (!pageData.access_token) {
    console.error('Page access token not found in response:', pageData);
    throw new Error('Page access token not found');
  }

  if (!pageData.instagram_business_account || !pageData.instagram_business_account.id) {
    console.error('Instagram business account not found:', pageData);
    throw new Error('Instagram business account not found');
  }

  return { 
    pageAccessToken: pageData.access_token, 
    instagramAccountId: pageData.instagram_business_account.id 
  };
}

app.post('/instagram/stories', zValidator('json', StoryRequestSchema), async (c) => {
  try {
    const story: StoryRequest = c.req.valid('json');
    const inspector: Inspector = story;

    const imgBuffer = await createImage(inspector);

    // Save the image to a file
    const folderPath = './images';
    await Bun.write(`${folderPath}/story.png`, imgBuffer);

    // Exchange token and get Instagram user token
    if (!SHORT_LIVED_ACCESS_TOKEN) {
      return c.json({ status: 'error', message: 'Missing SHORT_LIVED_ACCESS_TOKEN' }, 400);
    }

    const longLivedToken = await exchangeToken(SHORT_LIVED_ACCESS_TOKEN);
    console.log('Long-lived token obtained:', longLivedToken);

    const { pageAccessToken, instagramAccountId } = await getInstagramUserToken(longLivedToken);

    console.log('Instagram Account ID:', instagramAccountId);
    console.log('Page Access Token:', pageAccessToken);

    return c.json({ status: 'success', message: 'Story image created successfully', instagramAccountId });
  } catch (error) {
    console.error('Error in /instagram/stories:', error);
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred' }, 500);
  }
});

export default {
  port: 8000,
  fetch: app.fetch,
};

console.log('Instagram Bot is running on port 8000');