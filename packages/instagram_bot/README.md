# Instagram Bot for Posting Inspector Data

This project is an automated bot that fetches inspector data, creates an image with the information, and posts it as an Instagram story. It's designed to run periodically, providing regular updates to followers about inspector locations.

## Features

-   Fetches inspector data from an API
-   Generates an image with inspector information
-   Posts the generated image as an Instagram story
-   Automatically refreshes access tokens
-   Cleans up old image files

## Prerequisites

-   Bun runtime
-   Instagram Business Account
-   [Facebook Developer Account](https://developers.facebook.com/) with an app that has [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/) access including the necessary permissions that are described in the [documentation](https://developers.facebook.com/docs/instagram-api/overview).

## Installation

1. Clone the repository:

    ```
    git clone https://github.com/FreiFahren/FreiFahren
    cd packages/instagram_bot
    ```

2. Install dependencies:
    ```
    bun install
    ```

## Configuration

1. Create a `.env` file in the root directory with the following variables:

    ```
    CLIENT_ID=your_facebook_app_client_id
    CLIENT_SECRET=your_facebook_app_client_secret
    PAGE_ID=your_facebook_page_id
    SHORT_LIVED_ACCESS_TOKEN=your_initial_short_lived_token
    API_URL=https://api.freifahren.org
    APP_URL=https://your-app-url.com
    ```

    You can get your `SHORT_LIVED_ACCESS_TOKEN` by using the [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)

2. Ensure your Facebook app has the necessary permissions: `instagram_basic`, `instagram_content_publish`, and `pages_read_engagement`.

## Usage

To start the bot:

```
bun start
```

The bot will run on port 8000 and perform the following actions:

-   Run a hourly job to fetch inspector data, create an image, and post it to Instagram. (It will not post during quiet hours (20:00-04:00 UTC))
-   Run a daily job to clean up old image files

## How It Works

1. **Fetching Data**: The bot fetches inspector data from the specified API endpoint.

2. **Image Creation**: Using the fetched data, it generates an image with inspector information.

3. **Instagram Posting**:

    - The bot authenticates with Instagram using the provided credentials.
    - It creates a media container with the generated image.
    - The media is then published as an Instagram story.

4. **Token Management**: The bot handles token refresh automatically to maintain continuous access.

5. **Cleanup**: A daily cron job removes image files older than 7 days to manage storage.
