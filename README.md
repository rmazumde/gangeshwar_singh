# Gangeshwar Singh — Personal Site

Low-cost, low-maintenance site for the poet, writer, and lyricist Gangeshwar Singh. Astro static export + Tailwind keep the site fast, cheap to host, and easy to edit via Markdown/JSON.

## Tech choices (why)
- Astro static build → zero-runtime pages, great Lighthouse scores, easy deploy to free hosts.
- Tailwind CSS → lean, utility-first styling.
- Local assets → all images/icons from the legacy pages are downloaded into the repo; only YouTube embeds stay external.
- Content stored in `src/content/*` (Markdown/JSON) → non-technical edits without touching components.

## Project structure
```
src/
  components/       # UI building blocks (Hero, Nav, BookCard, VideoCard, etc.)
  layouts/          # Base layout with SEO + nav + footer
  pages/            # Routes (home, profile pages, books, press, gallery, contact)
  content/          # Markdown/JSON content
    pages/          # Home, Poet & Writer, Lyricist, Professional career, Critics, Contact
    poems/
    books/
    achievements/
    press/
    photos/
    videos/         # videos.json (YouTube embeds)
public/             # Favicons, robots.txt, downloaded assets under assets/source/legacy-archive
scripts/            # import_from_calcuttayellowpages.js + import_report.md
```

## Local development
```bash
npm install
npm run import:source # one-time or whenever refreshing assets/content from source pages
npm run dev           # http://localhost:4321
npm run build         # production build to dist/
```

## Importing source content (one-time or refresh)
1) Install deps: `npm install`
2) Run importer: `npm run import:source`
   - Downloads images/icons/CSS assets to `public/assets/source/legacy-archive`
   - Refreshes Markdown (books/press/achievements/photos) to point at local assets
   - Writes `src/content/videos/videos.json` with YouTube embeds from the gallery page
   - Emits `scripts/import_report.md` (assets downloaded, missing assets, pages parsed, YouTube list)
3) Verify assets: run `npm run build` and confirm `dist` has no `calcuttayellowpages.com` references (YouTube embeds are expected).

## Editing content
- Home/profile copy: `src/content/pages/*.md`
- Featured poem: `src/content/poems/`
- Books: `src/content/books/` (frontmatter: `title`, `genre`, `language`, `description`, optional `status`, `cover`, `buyLink`)
- Achievements: `src/content/achievements/` (`title`, optional `image`/`link`)
- Press: `src/content/press/` (`type: clip | article | video`, `link`, optional `image`)
- Photos: `src/content/photos/` (`image` path + caption), images should be local (e.g., under `public/assets/source/legacy-archive`)
- Videos: `src/content/videos/videos.json` (`youtubeUrl`, `title`, optional `category`/`description`)
- Contact form text: `src/content/pages/contact.md` (Formspree endpoint lives in `src/pages/contact.astro`)

After editing, run `npm run build` to validate.

## Contact form (Formspree)
- Replace `https://formspree.io/f/your-form-id` in `src/pages/contact.astro` with your Formspree form ID.
- Netlify Forms option: set `action="/"`, add `name="contact"` and `data-netlify="true"`, and deploy to Netlify.

## SEO & performance
- Structured data: Person (home) and ItemList of Books (books page).
- OG/Twitter tags via `src/components/SEO.astro`.
- `sitemap-index.xml` and `robots.txt` generated in `dist/`.
- Semantic HTML + alt text; minimal JS (navigation only); lazy-loaded images.

## Deployment
Primary (Cloudflare Pages — free, gangeshwarwrites.com)
1) Connect repo to Cloudflare Pages.
2) Build command: `npm run build`
3) Output directory: `dist`
4) Node 18+ in build settings.
5) Add custom domain gangeshwarwrites.com and follow Cloudflare’s DNS prompt (usually a CNAME from `www` to the Pages hostname; apex can use a CNAME flattening or A/AAAA per Cloudflare instructions).

Alternative A (GitHub Pages — free)
1) Push repo to GitHub.
2) In Settings → Pages, choose GitHub Actions with a static site workflow.
3) Action steps: `npm install`, `npm run build`, publish `dist/`.

Alternative B (Netlify — free, gangeshwarwrites.com)
1) New site from Git; build command `npm run build`, publish directory `dist`.
2) (Optional) Enable Netlify Forms as above.
3) Add custom domain gangeshwarwrites.com in Domain settings; set DNS with your registrar to point `www` CNAME to `your-site.netlify.app`, and set apex A/ALIAS per Netlify instructions.

## Content and usage rights
- Confirm you have permission to reuse photos, logos, press clippings, and any third-party content before publishing.
- YouTube links remain hosted on YouTube; ensure you have rights to embed them.

## Notes
- Videos are YouTube embeds to keep bandwidth costs near zero.
- Decap CMS not included to keep the stack minimal; content structure is CMS-ready if you want to add it later.
