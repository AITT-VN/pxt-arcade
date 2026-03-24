# Deployment Guide

This document describes how to build and deploy OhStem MakeCode Arcade to a static web hosting environment like AWS S3 + CloudFront.

## 1. Build Process

To build the static package for deployment, a build script has been created to optimize size and include custom changes. 

Open a terminal in the `pxt-arcade` directory and run:

```bash
.\build_deploy.bat
```

**What the script does:**
1. Builds `pxt-core` from local `pxt/` sources to include OhStem customizations.
2. Links the local `pxt-core` into `pxt-arcade/node_modules/pxt-core`.
3. Runs `pxt staticpkg --minify` to generate the static web app while compressing JavaScript.
4. Cleans up unnecessary directories (like `docs/graveyard/` and `docs/test/`) to reduce build size by over 350+ MB.
5. Creates a junction link `built/packaged/static` mapping to `built/packaged/docs/static` for local testing.

Output will be generated in the `built/packaged/` directory.

## 2. Deploying to AWS S3 & CloudFront

When deploying to S3 and serving via CloudFront, there is a known path mapping issue: the PXT web application requests static assets at `/static/...` (e.g., banner images, favicons), but they are actually compiled to `docs/static/...` in the packaged build. 

For local testing, the `build_deploy.bat` script creates a junction link, but S3 does not support junction/symlinks.

### Step-by-Step Deployment:

**1. Prepare the build folder**

Before uploading to S3, you **MUST** delete the `static` junction link in the build folder to avoid duplicate file uploads and wasted space:
```bash
rmdir built\packaged\static
```

**2. Upload to S3**

Upload the entire contents of `built/packaged/` to your S3 bucket using the AWS CLI or Console.

**3. Create a CloudFront Rewrite Function**

To fix the `/static/` paths without duplicating files, create a CloudFront Function to rewrite the requested URL paths:
1. Go to **AWS Console** > **CloudFront** > **Functions**.
2. Click **Create function** and name it `rewrite-static-path`.
3. Add the following code:
```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Rewrite /static/* -> /docs/static/*
    if (uri.startsWith('/static/')) {
        request.uri = '/docs' + uri;
    }

    // Default document for directories
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    }

    return request;
}
```
4. Save and click **Publish function**.

**4. Attach Function to CloudFront Distribution**

1. Go to your CloudFront **Distributions** and select your distribution.
2. Go to the **Behaviors** tab and **Edit** the Default `(*)` behavior.
3. Scroll down to **Function associations**.
4. In the **Viewer request** row, select **CloudFront Functions** and choose the `rewrite-static-path` function.
5. **Save changes** and wait for the distribution to deploy.

Once deployed on CloudFront, all custom assets like Web Favicon, Banner Carousels, and OhStem Dialog Logos will load correctly!
