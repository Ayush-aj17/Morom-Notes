# Morom Notes (Frontend Web Application)

This is the production-ready React client for the Morom Notes ecosystem. Built on Vite 6 and React 19, this SPA leverages an ultra-fast build toolchain and provides a dynamic interface for AI-generated lecture note management.

## Core Features
1. **Markdown Editor & Engine**: Converts deeply nested markdown syntax flawlessly to the DOM using `react-markdown` and `remark/rehype` plugins featuring math/equation support (`KaTeX`).
2. **Beautiful Highlighting & PDF Output**: Highly customized `html2canvas` and `jsPDF` renderers ensure accurate markdown exports, retaining UI elements flawlessly onto segmented responsive A4 layouts.
3. **Advanced State UI**: Clean, animated Tailwind-backed interface utilizing Lucide icons for rich UX interactions.
4. **JWT Flow Handling**: Secured token injection built natively into standard fetch utilities via Context API wrappers.

## Requirements

- **Node.js**: v18.0 or higher
- **npm** or **yarn**

## Environment Setup

Create a `.env` file at the root of the `frontend` directory map:
```env
# Point this to your production API base URL or localhost proxy.
VITE_API_BASE_URL=http://localhost:8000
```

For Vercel, set `VITE_API_BASE_URL` to the public URL of the deployed FastAPI
backend, for example `https://your-backend.onrender.com` (without a trailing
slash), then redeploy the frontend. Requests such as `/auth/signup` and
`/health` are sent to that backend.

## Development

Install the core dependencies:
```bash
npm install
```

Start the Vite development engine map with Hot-Module-Replacement:
```bash
npm run dev
```

## Production Deployment

This interface is an aggressively optimized static site and is ready to deploy natively to Edge/CDN networks like **Vercel**, **Netlify**, or **Cloudflare Pages**. 

1. **Build the Application**:
   ```bash
   npm run build
   ```
   This compiles all React components into a single highly optimized static `dist/` directory, purging unneeded Tailwind CSS paths.

2. **Serve Built Assets**:
   You can serve the contents natively via NGINX or directly deploy the `dist/` folder.
   To test locally beforehand:
   ```bash
   npm run preview
   ```

### Routing Considerations
Because this is a Single Page Application (SPA) driven by `react-router-dom`, **catch-all rewrites** are required on the server architecture:
- If deploying to **Vercel**, drop a `vercel.json` file in root specifying rewrite fallback.
- If using **NGINX**, configure `try_files $uri $uri/ /index.html;` inside the root location block. Otherwise, refreshing on non-root URL links (like `/dashboard`) will trigger a `404 Not Found` error.

## Advanced Styling Integrations
- Font subsets: Google Fonts ('Caveat', 'Inter') are attached globally via `index.html`.
- Editor UI handles custom paginated block logic across `data-a4-page` nodes dynamically reacting to markdown block dimensions.
- Highlighting bindings implement clone break-boxes to ensure multiline strong text parses natively in raw Print APIs.
