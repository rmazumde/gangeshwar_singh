#!/usr/bin/env node
/**
 * One-time importer for calcuttayellowpages content.
 * - Downloads images/icons/CSS assets to public/assets/source/legacy-archive
 * - Extracts books, press, achievements, photos, and videos into local data
 * - Rewrites content Markdown files with local asset paths where possible
 * - Produces scripts/import_report.md with findings
 *
 * Idempotent: deduplicates by content hash and reuses existing manifest.
 */
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { load as loadHtml } from "cheerio";
import slugify from "slugify";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = "https://www.calcuttayellowpages.com";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "assets", "source", "legacy-archive");
const MANIFEST_PATH = path.join(__dirname, "import-manifest.json");
const REPORT_PATH = path.join(__dirname, "import_report.md");
const VIDEOS_JSON = path.join(__dirname, "..", "src", "content", "videos", "videos.json");

const PAGES = [
  { key: "home", url: `${BASE}/adver/113288.html` },
  { key: "poet", url: `${BASE}/adver/113288gangeshwar_singh_poet.html` },
  { key: "books", url: `${BASE}/adver/113288books.html` },
  { key: "gallery", url: `${BASE}/adver/113288gallery.html` },
  { key: "press", url: `${BASE}/adver/113288press_review.html` },
  { key: "achievements", url: `${BASE}/adver/113288achievement.html` },
  { key: "contact", url: `${BASE}/adver/113288contact.html` }
];

const DELAY_MS = 320;

const report = {
  totalAssetsDownloaded: 0,
  missingAssets: [],
  youtubeUrls: [],
  pagesFailed: []
};

const manifest = {
  hashToPath: {},
  urlToPath: {},
  totalDownloads: 0
};

async function loadManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf-8");
    const data = JSON.parse(raw);
    Object.assign(manifest, data);
  } catch {
    // fresh manifest
  }
}

async function saveManifest() {
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeSlug(value) {
  return slugify(value, { lower: true, strict: true, trim: true });
}

function hashBuffer(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function toAbsolute(url, base) {
  if (!url) return null;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function downloadAsset(rawUrl, context = "") {
  const absoluteUrl = toAbsolute(rawUrl, BASE);
  if (!absoluteUrl) return null;

  if (manifest.urlToPath[absoluteUrl]) {
    return manifest.urlToPath[absoluteUrl];
  }

  let buffer;
  try {
    buffer = await fetchBuffer(absoluteUrl);
  } catch (err) {
    report.missingAssets.push({ url: absoluteUrl, reason: err.message });
    return null;
  }

  const hash = hashBuffer(buffer);
  if (manifest.hashToPath[hash]) {
    manifest.urlToPath[absoluteUrl] = manifest.hashToPath[hash];
    return manifest.hashToPath[hash];
  }

  const urlObj = new URL(absoluteUrl);
  const baseName = path.basename(urlObj.pathname) || "asset";
  const ext = path.extname(baseName) || ".bin";
  const nameOnly = path.basename(baseName, ext);
  const safeName = safeSlug(nameOnly) || "asset";
  const finalName = `${safeName}${ext}`;

  const folder = path.join(OUTPUT_DIR, context);
  await ensureDir(folder);

  let destName = finalName;
  let destPath = path.join(folder, destName);

  if (await fileExists(destPath)) {
    const existing = await fs.readFile(destPath);
    const existingHash = hashBuffer(existing);
    if (existingHash !== hash) {
      destName = `${safeName}-${hash.slice(0, 8)}${ext}`;
      destPath = path.join(folder, destName);
    }
  }

  await fs.writeFile(destPath, buffer);
  const relativePath = "/" + path.join("assets", "source", "calcuttayellowpages", context, destName).replace(/\\/g, "/");

  manifest.hashToPath[hash] = relativePath;
  manifest.urlToPath[absoluteUrl] = relativePath;
  manifest.totalDownloads += 1;
  report.totalAssetsDownloaded += 1;

  return relativePath;
}

function collectImageUrls($, baseUrl) {
  const imgs = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    const abs = toAbsolute(src, baseUrl);
    if (abs) imgs.push(abs);
  });
  return imgs;
}

async function collectCssAssets($, baseUrl) {
  const cssLinks = $("link[rel=stylesheet]").map((_, el) => $(el).attr("href")).get();
  const assets = [];
  for (const href of cssLinks) {
    const cssUrl = toAbsolute(href, baseUrl);
    if (!cssUrl) continue;
    try {
      const css = await fetchText(cssUrl);
      const matches = [...css.matchAll(/url\(([^)]+)\)/g)];
      for (const match of matches) {
        const raw = match[1].replace(/['"]/g, "");
        if (raw.startsWith("data:")) continue;
        const assetUrl = toAbsolute(raw, cssUrl);
        if (assetUrl) assets.push(assetUrl);
      }
      // Save CSS itself
      await downloadAsset(cssUrl, "css");
      await sleep(DELAY_MS);
    } catch (err) {
      report.missingAssets.push({ url: cssUrl, reason: err.message });
    }
  }
  return assets;
}

async function writeMarkdown(filePath, data, content = "") {
  const fm = matter.stringify(content, data);
  await fs.writeFile(filePath, fm);
}

async function updateContentFile(filePath, updater) {
  let frontmatter = {};
  let body = "";
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = matter(raw);
    frontmatter = parsed.data || {};
    body = parsed.content || "";
  } catch {
    // new file
  }
  const { data, content } = await updater({ data: frontmatter, content: body });
  await writeMarkdown(filePath, data, content);
}

async function processBooks($, pageUrl) {
  const entries = [];
  $(".publishBook").each((_, el) => {
    const title = $(".bookName", el).text().trim();
    const genre = $(".bookGenre", el).text().replace("Genre -", "").trim();
    const imgSrc = $("img", el).attr("src");
    if (!title) return;
    entries.push({ title, genre, imgSrc });
  });

  for (const entry of entries) {
    const slug = safeSlug(entry.title);
    const cover = entry.imgSrc ? await downloadAsset(toAbsolute(entry.imgSrc, pageUrl), "books") : null;
    await updateContentFile(path.join(__dirname, "..", "src", "content", "books", `${slug}.md`), async ({ data, content }) => {
      const nextData = {
        ...data,
        title: entry.title,
        genre: entry.genre || data.genre || "Book",
        language: data.language || "Hindi",
        description: data.description || "",
        status: data.status || "Published",
        cover: cover || data.cover
      };
      return { data: nextData, content: content || "" };
    });
  }
}

async function processAchievements($, pageUrl) {
  const items = [];
  $(".achievementBox").each((_, el) => {
    const link = $("a", el).attr("href");
    if (link) items.push(link);
  });

  let index = 1;
  for (const link of items) {
    const localPath = await downloadAsset(toAbsolute(link, pageUrl), "achievements");
    const title = `Achievement ${index}`;
    const slug = `achievement-${index}`;
    await updateContentFile(path.join(__dirname, "..", "src", "content", "achievements", `${slug}.md`), async ({ data, content }) => ({
      data: { title: data.title || title, image: localPath || data.image, description: data.description || "" },
      content: content || ""
    }));
    index += 1;
  }
}

async function processPress($, pageUrl) {
  const clips = [];
  $(".achievementBox").each((_, el) => {
    const link = $("a", el).attr("href");
    const img = $("img", el).attr("src");
    if (link || img) clips.push({ link, img, type: "clip" });
  });

  const articles = [];
  $(".articlesBox").each((_, el) => {
    const link = $("a", el).attr("href");
    const img = $("img", el).attr("src");
    if (link) articles.push({ link, img, type: "article" });
  });

  const all = [...clips, ...articles];
  let idx = 1;
  for (const item of all) {
    const baseSlug = safeSlug(path.basename(item.link || item.img || `press-${idx}`));
    const slug = baseSlug || `press-${idx}`;
    const localImage = item.img ? await downloadAsset(toAbsolute(item.img, pageUrl), "press") : null;
    const localFile = item.link ? await downloadAsset(toAbsolute(item.link, pageUrl), "press") : null;
    await updateContentFile(path.join(__dirname, "..", "src", "content", "press", `${slug}.md`), async ({ data, content }) => ({
      data: {
        title: data.title || slug.replace(/-/g, " "),
        link: localFile || localImage || data.link || "",
        type: item.type || data.type || "clip",
        description: data.description || "",
        image: localImage || data.image
      },
      content: content || ""
    }));
    idx += 1;
  }
}

async function processGallery($, pageUrl) {
  const photos = [];
  $(".galleryBox").each((_, el) => {
    const img = $("img", el).attr("src");
    const caption = $("p", el).text().trim() || $("img", el).attr("alt") || "";
    if (img) photos.push({ img, caption });
  });

  let idx = 1;
  for (const photo of photos) {
    const localImage = await downloadAsset(toAbsolute(photo.img, pageUrl), "gallery");
    const title = photo.caption || `Gallery ${idx}`;
    const slug = safeSlug(title) || `gallery-${idx}`;
    await updateContentFile(path.join(__dirname, "..", "src", "content", "photos", `${slug}.md`), async ({ data, content }) => ({
      data: { title: data.title || title, image: localImage || data.image, caption: data.caption || photo.caption },
      content: content || ""
    }));
    idx += 1;
  }

  // Videos
  const videos = [];
  $(".galleryBox iframe").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const url = toAbsolute(src, pageUrl);
    const nextText = $(el).parent().find("p").first().text().trim();
    const title = nextText || url;
    videos.push({ title, youtubeUrl: url, description: nextText });
  });
  report.youtubeUrls = videos.map((v) => v.youtubeUrl);
  const normalized = videos.map((v, i) => ({
    slug: safeSlug(v.title) || `video-${i + 1}`,
    title: v.title,
    youtubeUrl: v.youtubeUrl,
    description: v.description || ""
  }));
  await ensureDir(path.dirname(VIDEOS_JSON));
  await fs.writeFile(VIDEOS_JSON, JSON.stringify(normalized, null, 2));
}

async function processIcons($, pageUrl) {
  const iconLinks = $("link[rel~='icon'], link[rel='shortcut icon']").map((_, el) => $(el).attr("href")).get();
  for (const link of iconLinks) {
    await downloadAsset(toAbsolute(link, pageUrl), "icons");
    await sleep(DELAY_MS);
  }
}

async function processPhotosFromPage($, pageUrl) {
  const imgs = collectImageUrls($, pageUrl);
  for (const img of imgs) {
    await downloadAsset(img, "misc");
  }
}

async function main() {
  await ensureDir(OUTPUT_DIR);
  await loadManifest();

  for (const page of PAGES) {
    try {
      const html = await fetchText(page.url);
      await sleep(DELAY_MS);
      const $ = loadHtml(html);

      // generic assets
      const imgs = collectImageUrls($, page.url);
      for (const img of imgs) {
        await downloadAsset(img, "page-assets");
      }
      await collectCssAssets($, page.url);
      await processIcons($, page.url);

      // specific extractors
      if (page.key === "books") await processBooks($, page.url);
      if (page.key === "achievements") await processAchievements($, page.url);
      if (page.key === "press") await processPress($, page.url);
      if (page.key === "gallery") await processGallery($, page.url);

      // also store miscellaneous photos
      await processPhotosFromPage($, page.url);
    } catch (err) {
      report.pagesFailed.push({ url: page.url, reason: err.message });
      console.error(`Failed ${page.url}`, err);
    }
  }

  await saveManifest();

  const reportLines = [
    "# Import report",
    "",
    `Total assets downloaded: ${report.totalAssetsDownloaded}`,
    "",
    "## YouTube URLs",
    ...report.youtubeUrls.map((u) => `- ${u}`),
    "",
    "## Missing assets",
    ...(report.missingAssets.length === 0 ? ["- None"] : report.missingAssets.map((m) => `- ${m.url} (${m.reason})`)),
    "",
    "## Pages failed",
    ...(report.pagesFailed.length === 0 ? ["- None"] : report.pagesFailed.map((p) => `- ${p.url} (${p.reason})`))
  ].join("\n");

  await fs.writeFile(REPORT_PATH, reportLines);
  console.log("Import complete. See import_report.md for details.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
