// Static site generator.
// Content: Supabase (published rows, anon key + RLS) when SUPABASE_URL/ANON_KEY are set,
// otherwise the starter files in /content. Output: /dist (Netlify publish directory).
import { mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { PLATFORMS, SOCIALS, RELEASE_TYPES, DEFAULTS, SEO_DEFAULTS, defaultShareImage, LEGAL_SLUGS, textOn, YT_ID, parseYouTube } from '../shared/schema.js';
import { LEGAL, LEGAL_DESC, renderBody } from '../shared/legal.js';

// Public settings: Netlify environment variables win; site.config.json (committed, public values only) is the fallback.
const cfgFile = await readFile(new URL('../site.config.json', import.meta.url), 'utf8').then(JSON.parse).catch(() => ({}));
const U = process.env.SUPABASE_URL || cfgFile.supabaseUrl || '';
const K = process.env.SUPABASE_ANON_KEY || cfgFile.supabaseAnonKey || '';
const SITE = (process.env.SITE_URL || cfgFile.siteUrl || 'https://okinvibezz.com').replace(/\/$/, '');
const live = Boolean(U && K);

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (/^https:\/\//.test(u || '') || /^\/assets\/[\w./%-]+$/.test(u || '')) ? esc(u) : '';
const httpsOnly = u => /^https:\/\//.test(u || '') ? esc(u) : '';
const abs = u => (u || '').startsWith('/') ? SITE + u : u;
const paras = t => String(t || '').split(/\n{2,}/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');
const ldjson = o => JSON.stringify(o).replace(/</g, '\\u003c');
const json = async p => JSON.parse(await readFile(new URL(`../content/${p}`, import.meta.url), 'utf8'));
const clip = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '\u2026' : s; };

async function q(path) {
  const r = await fetch(`${U}/rest/v1/${path}`, { headers: { apikey: K, Authorization: `Bearer ${K}` } });
  if (!r.ok) throw new Error(`Supabase ${r.status} on ${path.split('?')[0]}: ${await r.text()}`);
  return r.json();
}
console.log(live ? 'Building from Supabase' : 'No Supabase env: building from /content starter files');

/* ---------- data ---------- */
let releases, gallery, events, dbPages = {}, S;
if (live) {
  const [rel, gal, ev, pg, st] = await Promise.all([
    q('music_releases?select=*,tracks(*),release_platform_links(*)&status=eq.published&order=release_date.desc.nullslast,published_at.desc'),
    q('gallery_items?status=eq.published&order=sort_order.asc,created_at.desc'),
    q('events?status=eq.published&order=event_date.asc').catch(() => []),
    q('pages?status=eq.published'),
    q('site_settings?select=data')
  ]);
  releases = rel; gallery = gal; events = ev; S = st[0]?.data || {};
  dbPages = Object.fromEntries(pg.map(p => [p.slug, p]));
} else {
  [releases, gallery, events, S] = await Promise.all([json('releases.json'), json('gallery.json'), json('events.json'), json('site.json')]);
}
const today = new Date().toISOString().slice(0, 10);
events = events.filter(e => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
releases.forEach(r => { r.tracks = (r.tracks || []).sort((a, b) => a.track_number - b.track_number); r.release_platform_links = (r.release_platform_links || []).filter(l => httpsOnly(l.url)).sort((a, b) => (b.is_primary - a.is_primary) || (a.display_order - b.display_order)); });

/* page copy: CMS value, else default from shared/schema.js */
const P = (page, key) => { const v = S.pages?.[page]?.[key]; return (v === undefined || v === null || v === '') ? DEFAULTS[page][key] : v; };
const SITEV = (key) => { const v = S.site?.[key]; return (v === undefined || v === null || v === '') ? DEFAULTS.site[key] : v; };
const tagline = SITEV('tagline'), bioShort = SITEV('bio_short'), bioFull = SITEV('bio_full');
const email = /^[^\s@]+@[^\s@]+$/.test(SITEV('contact_email') || '') ? esc(SITEV('contact_email')) : null;
const featuredVideo = parseYouTube(SITEV('featured_video_id'));
const artistUrl = safeUrl(SITEV('artist_photo'));
const streaming = PLATFORMS.map(p => ({ ...p, url: httpsOnly(S.streaming?.[p.key]) }));
const socials = SOCIALS.map(p => ({ ...p, url: httpsOnly(S.socials?.[p.key]) })).filter(p => p.url);
const videos = [...(featuredVideo ? [{ title: 'Featured video', video_id: featuredVideo }] : []), ...gallery.filter(g => g.media_type === 'video' && YT_ID.test(g.video_id || '') && g.video_id !== featuredVideo).map(g => ({ title: g.title, video_id: g.video_id }))];

const photos = gallery.filter(g => g.media_type === 'photo' && safeUrl(g.media_url));
const year = new Date().getUTCFullYear();
const updated = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const typeLabel = t => RELEASE_TYPES.find(x => x.key === t)?.label || 'Release';
const fmtLong = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
const fmtDur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';

/* ---------- icons & small components ---------- */
const ICONS = {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M2 21h20M8 8h2M8 12h2M8 16h2"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>',
  camera: '<rect x="3" y="6.5" width="18" height="13" rx="2.5"/><circle cx="12" cy="13" r="3.5"/><path d="M8.5 6.5l1.2-2.5h4.6l1.2 2.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  download: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const SERVICE_ICONS = ['mic', 'building', 'cap', 'camera'];
const pico = p => `<span class="pico" style="--c:${p.color};--t:${textOn(p.color)}" aria-hidden="true">${esc(p.abbr)}</span>`;

const ARTIST_ALT = 'Okin Vibezz wearing a monogram-print denim jacket over a white tee';
const artistPic = (extra = '', override = '') => {
  const u = safeUrl(override) || artistUrl;
  return u ? `<img src="${u}" alt="${ARTIST_ALT}" width="800" height="800" ${extra}>`
    : `<picture><source srcset="/assets/artist/okin-vibezz.webp" type="image/webp"><img src="/assets/artist/okin-vibezz-2x.jpg" alt="${ARTIST_ALT}" width="800" height="800" ${extra}></picture>`;
};

/* ---------- layout ---------- */
const nav = [['/', 'Home'], ['/music/', 'Music'], ['/videos/', 'Videos'], ['/live/', 'Live'], ['/images/', 'Images'], ['/about/', 'About'], ['/contact/', 'Contact']];
const isCurrent = (href, path) => href === '/' ? path === '/' : path.startsWith(href);
const socialLinks = () => socials.map(s => `<a rel="noopener" target="_blank" href="${s.url}">${esc(s.label)}</a>`).join('');
const cfg = `<script>window.SITE_CFG=${ldjson({ fn: U ? `${U}/functions/v1/submit-form` : '', key: K || '' })}</script>`;

const rawHttps = u => /^https:\/\//.test(u || '') ? u : '';
const page = ({ key = '', title, desc, path, body, scripts = [], noFab = false, ld = null, robots = '', image = '', imageSize = null, crumb = '' }) => {
  const d = SEO_DEFAULTS[key];
  if (d) { title = P(key, 'seo_title') || d.title; desc = P(key, 'seo_description') || d.desc; image = rawHttps(P(key, 'og_image')) || image; imageSize = image ? [1200, 630] : null; }
  const og = image ? abs(image) : SITE + defaultShareImage(key);
  const size = image ? imageSize : [1200, 630];
  const crumbLd = path === '/' || robots ? null : { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, ...(path.startsWith('/music/') && path !== '/music/' ? [{ '@type': 'ListItem', position: 2, name: 'Music', item: SITE + '/music/' }] : []), { '@type': 'ListItem', position: path.startsWith('/music/') && path !== '/music/' ? 3 : 2, name: crumb || title.split(' | ')[0], item: SITE + path }] };
  const lds = [ld, crumbLd].filter(Boolean);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="${robots || 'index,follow,max-image-preview:large'}"><meta name="author" content="Okin Vibezz">
<link rel="canonical" href="${SITE}${path}"><meta name="theme-color" content="#fffbf0"><meta name="color-scheme" content="light">
<meta property="og:site_name" content="Okin Vibezz"><meta property="og:locale" content="en"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${path === '/' ? 'website' : 'article'}"><meta property="og:url" content="${SITE}${path}"><meta property="og:image" content="${esc(og)}">${size ? `<meta property="og:image:width" content="${size[0]}"><meta property="og:image:height" content="${size[1]}">` : ''}<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(og)}"><meta name="twitter:image:alt" content="${esc(title)}">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="32x32" href="/assets/branding/favicon-32.png"><link rel="icon" type="image/png" sizes="16x16" href="/assets/branding/favicon-16.png"><link rel="apple-touch-icon" href="/assets/branding/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/css/base.css">${lds.map(l => `<script type="application/ld+json">${ldjson(l)}</script>`).join('')}</head>
<body><a class="skip" href="#main">Skip to content</a><div class="progress" aria-hidden="true"></div>
<header class="hdr"><div class="wrap"><a class="brand" href="/" aria-label="Okin Vibezz, home"><img src="/assets/branding/logo-emblem.png" alt="" width="46" height="46"><span>Okin Vibezz<small>Music Nation</small></span></a>
<button class="menu-toggle" aria-expanded="false" aria-controls="nav" aria-label="Toggle menu"><span></span></button>
<nav class="nav" id="nav" aria-label="Main">${nav.map(([h, t]) => `<a href="${h}"${isCurrent(h, path) ? ' aria-current="page"' : ''}>${t}</a>`).join('')}<a class="btn sm" href="/booking/">Book Okin</a></nav></div></header>
<main id="main">${body}</main>
<footer class="ftr"><div class="wrap"><div class="fgrid">
<div><img class="lockup" src="/assets/branding/logo-lockup.png" alt="Okin Music Nation" width="150" height="150" loading="lazy"><p>${esc(bioShort)}</p>${socials.length ? `<div class="socials">${socialLinks()}</div>` : ''}</div>
<div><h2>Explore</h2><ul>${nav.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}<li><a href="/press/">Press Kit</a></li></ul></div>
<div><h2>Work with Okin</h2><ul><li><a href="/booking/">Booking requests</a></li><li><a href="/press/">Press &amp; media</a></li><li><a href="/contact/?subject=Licensing%20enquiry">Licensing &amp; rights</a></li><li><a href="/contact/">General enquiries</a></li></ul></div>
<div><h2>Legal</h2><ul>${LEGAL_SLUGS.map(k => `<li><a href="/legal/${k}/">${esc(dbPages[k]?.title || LEGAL[k][0])}</a></li>`).join('')}</ul></div></div>
<div class="copy"><span>&copy; ${year} Okin Vibezz &middot; Okin Music Nation. All rights reserved.</span><a href="#top" data-top>Back to top &uarr;</a></div></div></footer>
${noFab ? '' : '<a class="btn fab" href="/booking/">Book Okin</a>'}${cfg}<script type="module" src="/js/ui.js"></script>${scripts.map(s => `<script type="module" src="/js/${s}.js"></script>`).join('')}</body></html>`;
};

const hero = ({ title, lead, crumbs = [] }) => `<section class="page-hero" id="top"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${crumbs.map(([h, t]) => `<i>/</i>${h ? `<a href="${h}">${t}</a>` : esc(t)}`).join('')}<i>/</i>${esc(title)}</nav>
<h1 class="rv">${esc(title)}</h1>${lead ? `<p class="lead rv">${esc(lead)}</p>` : ''}</div></section>`;
const secHead = (eyebrow, title, extra = '', center = false) => `<div class="sec-head${center ? ' center-head' : ''}"><div class="rv"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div>${extra}</div>`;
/* heading with the last word highlighted */
const hl = t => { const w = String(t).trim().split(/\s+/); const last = w.pop(); return `${esc(w.join(' '))}${w.length ? ' ' : ''}<span class="mark">${esc(last)}</span>`; };

const card = (r, i = 0) => {
  const cover = safeUrl(r.cover_url);
  const sub = r.tracks.length > 1 ? `${r.tracks.length} tracks` : clip(r.description, 70);
  return `<article class="card rv" data-type="${esc(r.release_type)}"><a class="ph c${(i % 3) + 1}${cover ? '' : ' nocover'}" href="/music/${esc(r.slug)}/" tabindex="-1" aria-hidden="true">${cover ? `<img src="${cover}" alt="" loading="lazy" width="480" height="480">` : `<img class="em" src="/assets/branding/logo-emblem.png" alt="" loading="lazy" width="120" height="120"><b>${esc(r.title)}</b>`}<span class="play" aria-hidden="true">${icon('arrow')}</span></a>
<div class="body"><div class="meta"><span class="tag">${typeLabel(r.release_type)}</span>${r.release_date ? `<span class="yr">${esc(String(r.release_date).slice(0, 4))}</span>` : ''}</div><h3><a href="/music/${esc(r.slug)}/">${esc(r.title)}</a></h3>${sub ? `<p>${esc(sub)}</p>` : ''}<span class="go">View details ${icon('arrow')}</span></div></article>`;
};

const soon = () => `<div class="soon rv"><div class="disc" aria-hidden="true"><img src="/assets/branding/logo-emblem.png" alt="" width="100" height="100"></div>
<div><span class="eyebrow">Coming soon</span><h3>New music is on the way</h3><p>The next Okin Vibezz release will appear here as soon as it goes live, with cover art, tracklist and links to every streaming platform.</p>
<div class="btn-row"><a class="btn" href="/contact/?subject=Release%20updates">Ask for release updates</a><a class="btn ghost" href="/about/">Meet the artist</a></div></div></div>`;
const noEvents = () => `<div class="events"><article class="event ghost rv"><time><b>TBA</b><span>Soon</span></time><div><h3>Dates to be announced</h3><p>Concerts, festivals and appearances will be listed here.</p></div><a class="btn sm" href="/contact/?subject=Show%20updates">Ask for updates</a></article>
<article class="event ghost rv"><time style="background:var(--violet);color:#fff"><b>You?</b><span>Your city</span></time><div><h3>Want Okin Vibezz at your event?</h3><p>Concerts, private events, campus shows and appearances are open for booking requests.</p></div><a class="btn sm" href="/booking/">Book Okin</a></article></div>`;
const noVideos = () => `<div class="vsoon rv"><div class="video placeholder" aria-hidden="true"><div><span>&#9654;</span></div></div><div><span class="eyebrow">Videos</span><h3>The first video is on the way</h3><p>Official music videos, live sessions and behind-the-scenes clips will play right here as soon as they are published.</p><div class="btn-row"><a class="btn" href="/contact/?subject=Video%20updates">Ask for updates</a><a class="btn ink" href="/images/">See the images</a></div></div></div>`;
const videoEmbed = v => `<div class="rv"><div class="video"><button data-embed="${esc(v.video_id)}" data-title="${esc(v.title)}"><span>&#9654;</span>Play video</button></div><h3>${esc(v.title)}</h3></div>`;
const fmtDate = d => { const dt = new Date(d + 'T00:00:00Z'); return { day: dt.getUTCDate(), mon: dt.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }), yr: dt.getUTCFullYear() }; };
const eventRow = e => { const d = fmtDate(e.event_date); return `<article class="event rv"><time datetime="${esc(e.event_date)}"><b>${d.day}</b><span>${d.mon} ${d.yr}</span></time><div><h3>${esc(e.title)}</h3><p>${[e.venue, e.city, e.country].filter(Boolean).map(esc).join(' &middot; ')}</p>${e.description ? `<p class="faint">${esc(clip(e.description, 140))}</p>` : ''}</div>${httpsOnly(e.ticket_url) ? `<a class="btn sm" rel="noopener" target="_blank" href="${httpsOnly(e.ticket_url)}">Tickets</a>` : ''}</article>`; };

const thumbOf = g => g.thumbnail_url || (g.media_type === 'video' && YT_ID.test(g.video_id || '') ? `https://i.ytimg.com/vi/${g.video_id}/hqdefault.jpg` : g.media_url);
/* One image tile: always 4:5, same size everywhere (the CMS crops uploads to 1200 x 1500) */
const im = (g, i) => `<button class="im rv z" type="button" role="listitem" data-full="${safeUrl(g.media_url)}" data-title="${esc(g.title)}" data-alt="${esc(g.alt_text || g.title)}" data-credit="${esc(g.credit)}" aria-label="View ${esc(g.title)}">
<img src="${safeUrl(g.thumbnail_url || g.media_url)}" alt="${esc(g.alt_text || g.title)}" width="1200" height="1500" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async"><span class="cap"><b>${esc(g.title)}</b>${g.caption ? `<small>${esc(clip(g.caption, 80))}</small>` : ''}</span><span class="zoom" aria-hidden="true">${icon('expand')}</span></button>`;

const field = (n, l, o = {}) => `<label>${l}${o.opt ? ' <small>(optional)</small>' : ''}${o.area
  ? `<textarea name="${n}" ${o.req ? 'required ' : ''}maxlength="${o.max || 3000}"${o.ph ? ` placeholder="${o.ph}"` : ''}></textarea>`
  : o.sel ? `<select name="${n}" required><option value="">Select</option>${o.sel.map(x => `<option>${x}</option>`).join('')}</select>`
  : `<input name="${n}" type="${o.type || 'text'}" ${o.req ? 'required ' : ''}maxlength="${o.max || 200}" ${o.ac ? `autocomplete="${o.ac}"` : ''}${o.ph ? ` placeholder="${o.ph}"` : ''}>`}</label>`;
const consent = t => `<label class="check"><input type="checkbox" name="consent" required><span>${t} <a href="/legal/privacy-policy/">Privacy Policy</a>.</span></label>`;
const tail = (btn = 'Send message') => `<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><button class="btn" type="submit">${btn}</button><p class="status" role="status" tabindex="-1"></p>`;
const faqHtml = items => `<div class="faq">${items.map(({ q: qq, a }) => `<details class="rv"><summary>${esc(qq)}</summary><div class="ans"><p>${esc(a).replace(/contact page/i, m => `<a href="/contact/">${m}</a>`).replace(/\n/g, '<br>')}</p></div></details>`).join('')}</div>`;
const ctaBand = (t, p, primary = ['/booking/', 'Request a booking'], second = ['/contact/', 'Contact the team']) => `<section><div class="wrap"><div class="cta-band rv"><span class="eyebrow">Okin Music Nation</span><h2>${esc(t)}</h2><p>${esc(p)}</p><div class="btn-row"><a class="btn" href="${primary[0]}">${primary[1]}</a><a class="btn ghost" href="${second[0]}">${second[1]}</a></div></div></div></section>`;
const panels = list => `<div class="cards">${list.map((s, n) => `<div class="panel c${(n % 4) + 1} rv"><div class="ico">${icon(SERVICE_ICONS[n % 4])}</div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('')}</div>`;
const stepsHtml = () => `<div class="steps">${P('booking', 'steps').map(s => `<div class="step rv"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('')}</div>`;

const listenGrid = () => `<div class="platforms">${streaming.map(p => p.url
  ? `<a class="rv" rel="noopener" target="_blank" href="${p.url}">${pico(p)}<span><b>${esc(p.label)}</b><small>Listen now</small></span><i class="go">${icon('arrow')}</i></a>`
  : `<div class="off rv" aria-disabled="true">${pico(p)}<span><b>${esc(p.label)}</b><small>Link coming soon</small></span></div>`).join('')}</div>`;
const listenChips = () => { const on = streaming.filter(p => p.url); return on.length ? `<div class="chips rv"><span class="faint">Stream on</span>${on.map(p => `<a rel="noopener" target="_blank" href="${p.url}">${pico(p)}${esc(p.label)}</a>`).join('')}<a class="all" href="/music/#listen">All platforms ${icon('arrow')}</a></div>` : ''; };

/* ---------- output ---------- */
const w = async (p, h) => { await mkdir(`dist/${p}`, { recursive: true }); await writeFile(`dist/${p}/index.html`, h); };
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const d of ['css', 'js', 'assets', 'admin', 'shared']) await cp(d, `dist/${d}`, { recursive: true });
await cp('assets/branding/favicon.ico', 'dist/favicon.ico');
await writeFile('dist/admin/config.js', `window.CMS_CONFIG=${ldjson({ url: U || '', anonKey: K || '', siteUrl: SITE })};\n`);
await writeFile('dist/site.webmanifest', JSON.stringify({
  name: 'Okin Vibezz', short_name: 'Okin Vibezz', description: 'Official website of Okin Vibezz, Okin Music Nation',
  start_url: '/', display: 'standalone', background_color: '#fffbf0', theme_color: '#fffbf0',
  icons: [{ src: '/assets/branding/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/branding/icon-512-solid.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
}));

const ticker = ['Okin Vibezz', 'Okin Music Nation', 'New music', 'Live shows', 'Bookings open', 'Official site'];
const track = `<span>${ticker.join('</span><span>')}</span>`;
const sticker = `<div class="sticker" aria-hidden="true"><svg class="ring" viewBox="0 0 120 120"><defs><path id="ring" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"/></defs><text><textPath href="#ring" textLength="276" lengthAdjust="spacing">Okin Music Nation &#8226; Okin Vibezz &#8226; </textPath></text></svg><img src="/assets/branding/logo-emblem.png" alt="" width="60" height="60"></div>`;

/* HOME */
const featuredGallery = photos.filter(g => g.featured).slice(0, 4);
await writeFile('dist/index.html', page({
  key: 'home', path: '/', scripts: [],
  ld: { '@context': 'https://schema.org', '@type': 'MusicGroup', name: 'Okin Vibezz', url: SITE, logo: `${SITE}/assets/branding/logo-emblem.png`, image: `${SITE}/assets/artist/okin-vibezz-2x.jpg`, description: bioShort, sameAs: [...socials.map(s => s.url), ...streaming.filter(s => s.url).map(s => s.url)] },
  body: `
<section class="hero" id="top"><div class="wrap hero-grid"><div class="stagger"><span class="eyebrow" style="--i:0">${esc(P('home', 'hero_eyebrow'))}</span><h1 style="--i:1"><span>${esc(P('home', 'hero_title_1'))}</span><span><i class="mark">${esc(P('home', 'hero_title_2'))}</i></span></h1>
<p class="lead" style="--i:2">${esc(P('home', 'hero_lead') || tagline)}</p>
<div class="btn-row" style="--i:3"><a class="btn" href="/music/">Listen now</a><a class="btn ghost" href="/booking/">Book Okin</a><a class="btn violet" href="/videos/">Watch videos</a></div>
<div class="hero-meta" style="--i:4"><span class="chip"><i></i>Okin Music Nation</span><span class="chip g"><i></i>Bookings open</span><span class="chip"><i></i>Press kit ready</span></div></div>
<figure class="hero-art"><span class="blob b2"></span><span class="blob"></span><div class="frame">${artistPic('fetchpriority="high"', P('home', 'hero_image'))}</div>${sticker}</figure></div>
<div class="ticker" aria-hidden="true"><div class="track">${track.repeat(4)}</div></div></section>

<section><div class="wrap">${secHead('Music', hl(P('home', 'music_title')), `<a class="btn ghost rv" href="/music/">All music</a>`)}
${releases.length ? `<div class="grid">${releases.slice(0, 4).map(card).join('')}</div>${listenChips()}` : soon()}</div></section>

<section class="s-violet"><div class="wrap">${secHead('Watch', esc(P('home', 'videos_title')), `<a class="btn rv" href="/videos/">All videos</a>`)}
${videos.length ? `<div class="vgrid">${videos.slice(0, 3).map(videoEmbed).join('')}</div>` : noVideos()}</div></section>

<section><div class="wrap">${secHead('Live', hl(P('home', 'live_title')), `<a class="btn ghost rv" href="/live/">All dates</a>`)}
${events.length ? `<div class="events">${events.slice(0, 4).map(eventRow).join('')}</div>` : noEvents()}</div></section>

<section class="s-tint"><div class="wrap split"><figure class="portrait rv">${artistPic('loading="lazy"')}<figcaption>Okin Vibezz</figcaption></figure>
<div class="rv"><span class="eyebrow">The artist</span><h2>${hl(P('home', 'about_title'))}</h2><p class="lead">${esc(bioShort)}</p>
<div class="pillars"><div><b>Music</b><span>Singles, EPs, albums</span></div><div><b>Live</b><span>Concerts and events</span></div><div><b>Visuals</b><span>Photos and video</span></div></div>
<div class="btn-row" style="margin-top:1.8rem"><a class="btn" href="/about/">Read the story</a><a class="btn ghost" href="/press/">Press kit</a></div></div></div></section>

<section><div class="wrap">${secHead('Live &amp; media', hl(P('home', 'services_title')))}${panels(P('home', 'services'))}</div></section>

${featuredGallery.length ? `<section class="s-sun"><div class="wrap">${secHead('Images', esc(P('home', 'gallery_title')), `<a class="btn ink rv" href="/images/">View all images</a>`)}
<div class="strip">${featuredGallery.map(g => `<a class="rv z" href="/images/" aria-label="${esc(g.title)}"><img src="${safeUrl(g.thumbnail_url || g.media_url)}" alt="${esc(g.alt_text || g.title)}" width="1200" height="1500" loading="lazy"></a>`).join('')}</div></div></section>` : ''}

<section><div class="wrap">${secHead('Bookings', hl(P('home', 'booking_title')), `<a class="btn ghost rv" href="/booking/">Start a request</a>`)}${stepsHtml()}</div></section>

${socials.length ? `<section class="s-white"><div class="wrap center"><span class="eyebrow rv">Stay connected</span><h2 class="rv">Follow Okin Vibezz</h2><div class="socials rv" style="justify-content:center">${socialLinks()}</div></div></section>` : ''}

${ctaBand(P('home', 'cta_title'), P('home', 'cta_text'))}`
}));

/* MUSIC */
const spot = releases.find(r => r.featured) || releases[0];
const spotLink = spot?.release_platform_links[0];
await w('music', page({
  key: 'music', path: '/music/', scripts: ['pages/music'],
  body: `${hero({ title: P('music', 'title'), lead: P('music', 'lead') })}
${spot ? `<section class="tight"><div class="wrap"><article class="spotlight rv"><a class="cover" href="/music/${esc(spot.slug)}/" aria-label="${esc(spot.title)}">${safeUrl(spot.cover_url) ? `<img src="${safeUrl(spot.cover_url)}" alt="Cover art for ${esc(spot.title)}" width="600" height="600">` : `<div class="nocover c1"><img class="em" src="/assets/branding/logo-emblem.png" alt="" width="140" height="140"><b>${esc(spot.title)}</b></div>`}</a>
<div class="info"><span class="eyebrow">${spot.featured ? 'Featured' : 'Latest'} ${typeLabel(spot.release_type)}</span><h2>${esc(spot.title)}</h2><p class="meta-line">${[spot.release_date && fmtLong(spot.release_date), spot.genre, spot.tracks.length > 1 && `${spot.tracks.length} tracks`].filter(Boolean).map(esc).join(' &middot; ')}</p>${spot.description ? `<p>${esc(clip(spot.description, 220))}</p>` : ''}
<div class="btn-row">${spotLink ? `<a class="btn" rel="noopener" target="_blank" href="${httpsOnly(spotLink.url)}">Listen on ${esc(spotLink.platform)}</a>` : ''}<a class="btn ${spotLink ? 'ghost' : ''}" href="/music/${esc(spot.slug)}/">View details</a></div></div></article></div></section>` : ''}
<section><div class="wrap">
${releases.length ? `<div class="sec-head center-head"><div class="rv"><span class="eyebrow">Discography</span><h2>All releases</h2></div></div>
<div class="filters" role="group" aria-label="Filter releases">${[['all', 'All'], ...RELEASE_TYPES.map(t => [t.key, t.filter])].map(([k, t]) => `<button data-filter="${k}" aria-pressed="false">${t}</button>`).join('')}</div>
<div class="grid">${releases.map(card).join('')}</div>` : soon()}
<p id="empty" class="empty" hidden>Nothing in this category yet.</p></div></section>
<section class="s-tint" id="listen"><div class="wrap center">${secHead('Streaming', esc(P('music', 'listen_title')), '', true)}<p class="lead rv" style="margin:-.6rem auto 2.4rem">${esc(P('music', 'listen_text'))}</p>${listenGrid()}</div></section>
${ctaBand('Want Okin Vibezz at your event?', 'Hear it live. Send a booking request and the team will take it from there.')}`
}));

for (const [i, r] of releases.entries()) {
  const prev = releases[i + 1], next = releases[i - 1];
  const more = releases.filter(x => x.id !== r.id).slice(0, 3);
  const cover = safeUrl(r.cover_url);
  const meta = [['Type', typeLabel(r.release_type)], r.release_date && ['Released', fmtLong(r.release_date)], r.genre && ['Genre', r.genre], r.label && ['Label', r.label], r.tracks.length && ['Tracks', String(r.tracks.length)]].filter(Boolean);
  await w(`music/${r.slug}`, page({
    key: 'release', title: r.seo_title || `${r.title} (${typeLabel(r.release_type)}) | Okin Vibezz`, path: `/music/${r.slug}/`, scripts: [], crumb: r.title, image: cover ? r.cover_url : '/assets/og/music.jpg',
    desc: r.seo_description || clip(r.description, 155) || `${r.title}, ${/^[aeiou]/i.test(typeLabel(r.release_type)) ? 'an' : 'a'} ${typeLabel(r.release_type).toLowerCase()} by Okin Vibezz on Okin Music Nation.${r.release_platform_links.length ? ' Stream on ' + r.release_platform_links.slice(0, 3).map(l => l.platform).join(', ') + '.' : ' Listen and see the full details.'}`,
    ld: { '@context': 'https://schema.org', '@type': r.release_type === 'single' ? 'MusicRecording' : 'MusicAlbum', name: r.title, byArtist: { '@type': 'MusicGroup', name: 'Okin Vibezz' }, ...(r.release_date ? { datePublished: r.release_date } : {}), ...(cover ? { image: abs(r.cover_url) } : {}), url: `${SITE}/music/${r.slug}/` },
    body: `<section class="page-hero release-hero" id="top"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><i>/</i><a href="/music/">Music</a><i>/</i>${esc(r.title)}</nav>
<div class="rel-grid"><div class="rv">${cover ? `<img class="release-cover" src="${cover}" alt="Cover art for ${esc(r.title)}" width="600" height="600">` : `<div class="release-cover nocover c1"><img class="em" src="/assets/branding/logo-emblem.png" alt="" width="160" height="160"><b>${esc(r.title)}</b></div>`}</div>
<div class="rv"><span class="tag light">${typeLabel(r.release_type)}</span><h1>${esc(r.title)}</h1><p class="lead">Okin Vibezz${r.label ? ' &middot; ' + esc(r.label) : ''}</p>
<div class="btn-row">${r.release_platform_links.slice(0, 3).map((l, n) => `<a class="btn${n ? ' ghost' : ''}" rel="noopener" target="_blank" href="${httpsOnly(l.url)}">${n ? '' : 'Listen on '}${esc(l.platform)}</a>`).join('') || `<a class="btn" href="/music/#listen">Find on streaming platforms</a>`}<button class="btn ghost" type="button" data-share="${esc(r.title)} by Okin Vibezz">${icon('share')} Share</button></div></div></div></div></section>
<section><div class="wrap split top side-r2"><div class="rv">${r.description ? `<span class="eyebrow">About this ${typeLabel(r.release_type).toLowerCase()}</span><div class="prose">${paras(r.description)}</div>` : ''}
${r.tracks.length ? `<h2 class="h-sm">Tracklist</h2><ol class="tracklist">${r.tracks.map(t => `<li><span class="tt">${esc(t.title)}${t.featured_artists ? ` <em>feat. ${esc(t.featured_artists)}</em>` : ''}${t.producer_credit ? ` <em>prod. ${esc(t.producer_credit)}</em>` : ''}</span>${t.duration_seconds ? `<span class="dur">${fmtDur(t.duration_seconds)}</span>` : ''}</li>`).join('')}</ol>` : ''}</div>
<aside class="rv sticky"><div class="panel"><h3>Details</h3><dl class="facts">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>
${r.release_platform_links.length ? `<div class="panel" style="margin-top:1.2rem"><h3>Listen</h3><div class="listen-list">${r.release_platform_links.map(l => { const p = PLATFORMS.find(x => x.label.toLowerCase() === String(l.platform).toLowerCase()) || { abbr: String(l.platform).slice(0, 2), color: '#6f4bff' }; return `<a rel="noopener" target="_blank" href="${httpsOnly(l.url)}">${pico(p)}<span>${esc(l.platform)}</span>${icon('arrow')}</a>`; }).join('')}</div></div>` : ''}</aside></div></section>
${(prev || next) ? `<section class="tight"><div class="wrap"><div class="pn">${prev ? `<a class="rv" href="/music/${esc(prev.slug)}/"><small>&larr; Previous</small><b>${esc(prev.title)}</b></a>` : '<span></span>'}${next ? `<a class="rv r" href="/music/${esc(next.slug)}/"><small>Next &rarr;</small><b>${esc(next.title)}</b></a>` : ''}</div></div></section>` : ''}
${more.length ? `<section class="s-tint"><div class="wrap">${secHead('Discover', 'More music', `<a class="btn ghost rv" href="/music/">All music</a>`)}<div class="grid">${more.map(card).join('')}</div></div></section>` : ''}`
  }));
}

/* VIDEOS */
await w('videos', page({
  key: 'videos', path: '/videos/',
  body: `${hero({ title: P('videos', 'title'), lead: P('videos', 'lead') })}<section><div class="wrap">${videos.length ? `<div class="vgrid">${videos.map(videoEmbed).join('')}</div>` : noVideos()}</div></section>
${ctaBand('Want Okin Vibezz at your event?', 'Send a booking request and the team will take it from there.')}`
}));

/* LIVE */
await w('live', page({
  key: 'live', path: '/live/',
  body: `${hero({ title: P('live', 'title'), lead: P('live', 'lead') })}<section><div class="wrap">${events.length ? `<div class="events">${events.map(eventRow).join('')}</div>` : noEvents()}</div></section>
<section class="s-tint"><div class="wrap">${secHead('Bookings', hl(P('live', 'book_title')), `<a class="btn rv" href="/booking/">Request a booking</a>`)}${panels(P('home', 'services'))}</div></section>`
}));

/* IMAGES (photos only, uniform 4:5 tiles, no filters) */
await w('images', page({
  key: 'images', path: '/images/', scripts: ['pages/images'],
  ld: { '@context': 'https://schema.org', '@type': 'ImageGallery', name: 'Okin Vibezz images', url: `${SITE}/images/`, image: photos.slice(0, 12).map(g => abs(g.media_url)) },
  body: `${hero({ title: P('images', 'title'), lead: P('images', 'lead') })}
<section><div class="wrap">
${photos.length ? `<div class="imgs" role="list">${photos.map(im).join('')}</div>` : `<div class="empty-note rv"><b>New images are coming soon</b><span>Official photos and visuals will appear here as they are released.</span></div>`}
</div></section>
<dialog id="lb" aria-label="Image viewer"><button class="close" aria-label="Close">&times;</button><button class="prev" aria-label="Previous image">&lsaquo;</button><button class="next" aria-label="Next image">&rsaquo;</button><figure style="margin:0;display:contents"><div class="stage"></div><figcaption></figcaption></figure><span class="count" aria-live="polite"></span></dialog>
${ctaBand('Need images for a feature or event?', 'Official press photos and logos are free to download in the press kit.', ['/press/', 'Open the press kit'], ['/contact/', 'Request more media'])}`
}));

/* ABOUT */
await w('about', page({
  key: 'about', path: '/about/',
  body: `${hero({ title: P('about', 'title'), lead: P('about', 'lead') })}
<section><div class="wrap split top"><figure class="portrait rv">${artistPic('loading="lazy"')}<figcaption>Okin Vibezz</figcaption></figure>
<div class="rv"><span class="eyebrow">The artist</span><h2>Okin Vibezz</h2><div class="dim prose">${paras(bioFull)}</div>
<div class="btn-row" style="margin-top:1.6rem"><a class="btn" href="/music/">Hear the music</a><a class="btn ghost" href="/booking/">Book Okin</a></div></div></div></section>
<section class="s-sun"><div class="wrap split"><div class="rv"><span class="eyebrow" style="background:var(--paper)">The label</span><h2>${esc(P('about', 'label_title'))}</h2><div class="prose">${paras(P('about', 'label_text'))}</div><a class="btn ghost" href="/press/">Brand assets</a></div>
<div class="rv" style="display:grid;place-items:center"><div class="logo-card"><img src="/assets/branding/logo-lockup.png" alt="Okin Music Nation logo" width="320" height="320" loading="lazy"></div></div></div></section>
<section><div class="wrap">${secHead('Explore', 'Everything in one place')}
<div class="cards">
<div class="panel c1 rv"><div class="ico">${icon('note')}</div><h3>Music</h3><p>Releases, tracklists and links to every streaming platform.</p><a class="more" href="/music/">Listen</a></div>
<div class="panel c2 rv"><div class="ico">${icon('camera')}</div><h3>Images</h3><p>Official photos and visuals of Okin Vibezz, in one place.</p><a class="more" href="/images/">Browse</a></div>
<div class="panel c3 rv"><div class="ico">${icon('download')}</div><h3>Press kit</h3><p>Bio, photos, logos and brand colours ready to download.</p><a class="more" href="/press/">Download</a></div>
<div class="panel c4 rv"><div class="ico">${icon('calendar')}</div><h3>Bookings</h3><p>Request Okin Vibezz for your concert, festival or private event.</p><a class="more" href="/booking/">Request</a></div></div></div></section>
${ctaBand('Let\u2019s work together', 'Booking, press, collaboration or licensing: tell us what you have in mind.')}`
}));

/* PRESS */
await w('press', page({
  key: 'press', path: '/press/',
  body: `${hero({ title: P('press', 'title'), lead: P('press', 'lead') })}
<section><div class="wrap split top"><div class="rv"><span class="eyebrow">Snapshot</span><h2>Artist facts</h2>
<div class="pillars two"><div><b>Artist</b><span>Okin Vibezz</span></div><div><b>Label</b><span>Okin Music Nation</span></div><div><b>Website</b><span>${esc(SITE.replace('https://', ''))}</span></div><div><b>Bookings</b><span>Via the booking page</span></div></div>
<div class="btn-row" style="margin-top:1.6rem"><a class="btn" href="/booking/">Booking request</a><a class="btn ghost" href="/contact/?subject=Press%20enquiry">Press enquiry</a></div></div>
<div class="rv"><span class="eyebrow">Short bio</span><h2>Approved copy</h2><div class="notice" style="margin-top:0">${esc(bioShort)}</div><div class="dim prose">${paras(bioFull)}</div></div></div></section>
<section class="s-tint"><div class="wrap">${secHead('Downloads', 'Photos &amp; logos')}
<div class="dl">
<div class="panel c1 rv"><div class="thumb cover">${artistPic('loading="lazy"')}</div><h3>Official artist photo</h3><p>Portrait of Okin Vibezz for features, flyers and event listings.</p><a class="btn sm" href="${artistUrl || '/assets/artist/okin-vibezz-2x.jpg'}" download>${icon('download')} Download</a></div>
<div class="panel c2 rv"><div class="thumb"><img src="/assets/branding/logo-lockup.png" alt="Okin Music Nation logo lockup" loading="lazy"></div><h3>Logo lockup</h3><p>Emblem with the OKIN Music Nation wordmark. Transparent PNG for dark backgrounds.</p><a class="btn sm" href="/assets/branding/logo-lockup.png" download>${icon('download')} PNG</a></div>
<div class="panel c3 rv"><div class="thumb"><img src="/assets/branding/logo-emblem.png" alt="Okin Music Nation emblem" loading="lazy"></div><h3>Emblem only</h3><p>The gold ring and wing on its own, for avatars, stamps and compact placements.</p><a class="btn sm" href="/assets/branding/logo-emblem.png" download>${icon('download')} PNG</a></div>
<div class="panel c4 rv"><div class="thumb"><img src="/assets/branding/okin-music-nation-logo.jpg" alt="Okin Music Nation logo on black" loading="lazy"></div><h3>Logo on black</h3><p>The original full logo on a solid black square, ready to drop onto dark layouts.</p><a class="btn sm" href="/assets/branding/okin-music-nation-logo.jpg" download>${icon('download')} JPG</a></div></div></div></section>
<section><div class="wrap split top"><div class="rv"><span class="eyebrow">Brand</span><h2>Colours</h2><p class="dim">The site palette: bright sun yellow, electric violet and coral on ink black, with the gold emblem.</p>
<div class="swatches"><div class="swatch"><i style="background:#12121a"></i><span><b>Ink</b>#12121A</span></div><div class="swatch"><i style="background:#ffc400"></i><span><b>Sun</b>#FFC400</span></div><div class="swatch"><i style="background:#6f4bff"></i><span><b>Violet</b>#6F4BFF</span></div><div class="swatch"><i style="background:#ff5c3a"></i><span><b>Coral</b>#FF5C3A</span></div></div></div>
<div class="rv"><span class="eyebrow">Guidelines</span><h2>Using the assets</h2><ul class="dim bullets"><li>Use the logo on black or dark backgrounds, or inside a black badge on light layouts.</li><li>Do not stretch, recolour, rotate or add effects to the logo.</li><li>Leave clear space around the emblem at least equal to the width of the ring stroke.</li><li>Credit &ldquo;Okin Music Nation&rdquo; where the photo or logo is published.</li><li>Music, video and artwork need written permission. See <a href="/legal/copyright-and-music-rights/">Copyright and Music Rights</a>.</li></ul></div></div></section>
${ctaBand('Writing about Okin Vibezz?', 'Send your enquiry, deadline and outlet, and the team will get back to you.', ['/contact/?subject=Press%20enquiry', 'Contact press team'], ['/about/', 'Read the full story'])}`
}));

/* CONTACT */
const contactCards = [['chat', 'General enquiries', 'Questions, feedback and collaboration ideas.', '#message'], ['calendar', 'Bookings', 'Concerts, festivals and private events.', '/booking/'], ['camera', 'Press &amp; media', 'Interviews, features and press assets.', '/contact/?subject=Press%20enquiry#message'], ['shield', 'Licensing &amp; rights', 'Sync, sampling and permission requests.', '/contact/?subject=Licensing%20enquiry#message']];
await w('contact', page({
  key: 'contact', path: '/contact/', scripts: ['forms'],
  body: `${hero({ title: P('contact', 'title'), lead: P('contact', 'lead') })}
<section><div class="wrap split top side-l">
<div class="rv"><span class="eyebrow">Reach us</span><h2>How can we help?</h2><div class="info-list">${contactCards.map(([i, t, p, h]) => `<a class="info-item" href="${h}"><div class="ico">${icon(i)}</div><div><b>${t}</b><span>${p}</span></div></a>`).join('')}
${email ? `<a class="info-item" href="mailto:${email}"><div class="ico">${icon('mail')}</div><div><b>Email</b><span>${email}</span></div></a>` : ''}</div>
${socials.length ? `<h3 style="margin-top:2rem;font-size:1.05rem">Find us online</h3><div class="socials">${socialLinks()}</div>` : ''}</div>
<div class="form-card rv" id="message"><h2 style="font-size:1.7rem">Send a message</h2><p class="dim">For event dates and fees, please use the <a href="/booking/">booking page</a> instead.</p>
<form data-form="contact" novalidate>${field('name', 'Full name', { req: 1, max: 120, ac: 'name' })}${field('email', 'Email address', { req: 1, type: 'email', max: 254, ac: 'email' })}${field('subject', 'Subject', { opt: 1 })}${field('message', 'Message', { req: 1, area: 1, max: 5000 })}${consent('I have read the')}${tail('Send message')}</form></div></div></section>`
}));

/* BOOKING */
await w('booking', page({
  key: 'booking', path: '/booking/', scripts: ['forms'], noFab: true,
  body: `${hero({ title: P('booking', 'title'), lead: P('booking', 'lead') })}
<section><div class="wrap">${secHead('Process', 'From request to confirmed date')}${stepsHtml()}</div></section>
<section class="s-tint" id="request"><div class="wrap split top side-r">
<div class="form-card rv"><h2 style="font-size:1.7rem">Booking request</h2><form data-form="booking" novalidate>
<div class="row">${field('name', 'Full name', { req: 1, max: 120, ac: 'name' })}${field('email', 'Email address', { req: 1, type: 'email', max: 254, ac: 'email' })}</div>
<div class="row">${field('phone', 'Phone', { opt: 1, type: 'tel', max: 40, ac: 'tel' })}${field('organisation', 'Organisation or company', { opt: 1, max: 160 })}</div>
<div class="row">${field('event_type', 'Event type', { sel: ['Concert', 'Festival', 'Private event', 'Campus event', 'Appearance', 'Interview', 'Other'] })}${field('event_date', 'Requested event date', { req: 1, type: 'date' })}</div>
<div class="row">${field('event_time', 'Event time', { opt: 1, type: 'time' })}${field('duration', 'Expected performance duration', { opt: 1, max: 60, ph: 'e.g. 45 minutes' })}</div>
<div class="row">${field('venue', 'Venue', { opt: 1 })}${field('city', 'City', { req: 1, max: 100 })}</div>${field('country', 'Country', { req: 1, max: 100 })}
${field('description', 'Event description', { req: 1, area: 1, ph: 'Tell us about the event, expected audience and your plans.' })}${field('budget', 'Budget range', { opt: 1, max: 60 })}${field('notes', 'Additional information', { opt: 1, area: 1 })}
${consent('I acknowledge this is an enquiry, not a confirmed booking, and I have read the')}${tail('Submit request')}</form></div>
<aside class="rv sticky"><h3>What to include</h3><ul class="dim bullets"><li>Event date, city and venue</li><li>Type of event and expected audience</li><li>Performance length and set time</li><li>Your budget range, if you have one</li><li>Anything special: sound, stage, travel</li></ul>
<div class="notice">Read the <a href="/legal/booking-terms/">Booking Terms</a> before you submit.</div></aside></div></section>
<section><div class="wrap">${secHead('FAQ', 'Booking questions')}${faqHtml(P('booking', 'faq'))}</div></section>`
}));

/* LEGAL */
for (const slug of LEGAL_SLUGS) {
  const o = dbPages[slug], t = o?.title || LEGAL[slug][0];
  await w(`legal/${slug}`, page({
    key: 'legal', title: `${t} | Okin Vibezz`, path: `/legal/${slug}/`, crumb: t, desc: o?.seo_description || LEGAL_DESC[slug],
    body: `${hero({ title: t, crumbs: [[null, 'Legal']] })}<section><div class="wrap"><div class="legal-nav">${LEGAL_SLUGS.map(k => `<a href="/legal/${k}/"${k === slug ? ' aria-current="page"' : ''}>${esc(dbPages[k]?.title || LEGAL[k][0])}</a>`).join('')}</div>
<div class="legal">${o?.body ? renderBody(o.body) : LEGAL[slug][1].map(([h, ps]) => `<h2>${esc(h)}</h2>${ps.map(x => `<p>${esc(x)}</p>`).join('')}`).join('')}<p class="faint">Last updated ${updated}.</p></div></div></section>`
  }));
}

/* 404 */
await writeFile('dist/404.html', page({
  title: 'Page not found | Okin Vibezz', path: '/404.html', robots: 'noindex', desc: 'That page does not exist or has moved.',
  body: `<section class="err404"><div class="wrap"><img src="/assets/branding/logo-emblem.png" alt="" width="110" height="110"><h1>404</h1><p class="lead">That page does not exist or has moved.</p><div class="btn-row"><a class="btn" href="/">Back home</a><a class="btn ghost" href="/music/">Browse music</a></div></div></section>`
}));

/* robots + sitemap */
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE}/sitemap.xml\n`);
const urls = ['/', '/music/', '/videos/', '/live/', '/images/', '/about/', '/press/', '/contact/', '/booking/', ...LEGAL_SLUGS.map(k => `/legal/${k}/`), ...releases.map(r => `/music/${r.slug}/`)];
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(p => `<url><loc>${SITE}${p}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${urls.length} pages: ${releases.length} releases, ${photos.length} images, ${videos.length} videos, ${events.length} upcoming shows`);
