# Vercel Speed Insights Configuration

## Overview

This website is configured with **Vercel Speed Insights**, which automatically tracks Core Web Vitals and performance metrics to help optimize site performance.

## What is Speed Insights?

Vercel Speed Insights provides detailed performance monitoring including:
- **Cumulative Layout Shift (CLS)** - Measures visual stability
- **First Input Delay (FID)** - Measures interactivity  
- **Largest Contentful Paint (LCP)** - Measures loading performance
- Additional performance metrics and analytics

## Current Implementation

### For Plain HTML Sites (No Build Step Required)

This website uses the automatic Vercel Speed Insights script tag approach:

```html
<!-- Vercel Speed Insights: Automatically tracks web vitals and performance metrics (CLS, FID, LCP) -->
<script defer src="/_vercel/insights/script.js"></script>
```

**Location:** Added to the `<body>` tag of all HTML files, just before the closing `</body>` tag.

**How it works:**
1. The script is automatically available when deployed on Vercel
2. It runs entirely on the **client side** with no server-side configuration needed
3. Data is collected passively without impacting page performance
4. No additional package installation required for plain HTML sites

## Files with Speed Insights Configuration

The following files have been configured with Speed Insights:

### Main Pages
- `index.html` - Home page
- `about.html` - About page
- `contact.html` - Contact page
- `projects.html` - Projects page
- `gallery.html` - Gallery page
- `blog.html` - Blog listing page

### Blog Posts
- `blog/social-media-ban.html` - Blog post detail

### Project Details
- `projects/project-aurora-arena.html` - Project detail
- `projects/project-personal-website.html` - Project detail
- `projects/project-shortform-toolkit.html` - Project detail

## Viewing Performance Data

Performance data is collected automatically and can be viewed in the Vercel dashboard:

1. Go to your project on [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to the **Analytics** tab
3. View real-time Core Web Vitals data
4. Track performance trends over time
5. Identify performance bottlenecks

## Key Features

✅ **Zero Configuration** - Automatically enabled on Vercel  
✅ **No Performance Impact** - Minimal overhead on your site  
✅ **Client-Side Only** - No server resources needed  
✅ **Real User Monitoring** - Tracks actual user experience  
✅ **Free** - Included with all Vercel plans  

## Framework-Specific Integration

For reference, if this project were using a framework, the setup would be:

### Next.js
```javascript
// app/layout.js or pages/_app.js
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function RootLayout() {
  return (
    <html>
      <body>
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### React
```javascript
import { injectSpeedInsights } from "@vercel/speed-insights"

injectSpeedInsights()
```

### Vue
```javascript
// main.js
import { injectSpeedInsights } from "@vercel/speed-insights"

injectSpeedInsights()
```

### Other Frameworks
For frameworks like Nuxt, SvelteKit, Remix, Astro - install `@vercel/speed-insights` and import the appropriate component or function for that framework.

## Deployment

Speed Insights is automatically activated when you deploy to Vercel. No additional steps needed:

1. Push your code to your repository
2. Vercel automatically detects and deploys changes
3. The `/_vercel/insights/script.js` endpoint becomes available
4. Data collection begins immediately

## Troubleshooting

### Script Not Loading
- Ensure you're deployed on Vercel
- Check that the script tag is present before `</body>`
- Verify `defer` attribute is included

### No Data Appearing
- Allow a few minutes for initial data collection
- Ensure your site is receiving traffic
- Check browser console for any script errors

### Performance Impact
- The script is highly optimized (< 10KB)
- Uses `defer` to prevent blocking page rendering
- Minimal CPU/memory overhead

## Documentation References

- [Vercel Speed Insights Documentation](https://vercel.com/docs/speed-insights)
- [Speed Insights Quickstart](https://vercel.com/docs/speed-insights/quickstart)
- [Core Web Vitals Guide](https://web.dev/vitals/)

## Support

For issues or questions:
- Check the [Vercel Documentation](https://vercel.com/docs)
- Review the [GitHub repository](https://github.com/vercel/speed-insights)
- Contact Vercel Support through the dashboard
