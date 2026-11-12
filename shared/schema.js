// Single source of truth for the website AND the CMS.
// The build script reads defaults from here; the admin app builds its editing forms from here.
// Plain ES module: works in Node (build) and in the browser (admin).

/* ---------- Streaming platforms (all shown on /music/#listen; links added in the CMS) ---------- */
export const PLATFORMS = [
  { key: 'spotify', label: 'Spotify', abbr: 'Sp', color: '#1DB954' },
  { key: 'apple_music', label: 'Apple Music', abbr: 'Am', color: '#FA243C' },
  { key: 'audiomack', label: 'Audiomack', abbr: 'Au', color: '#FFA200' },
  { key: 'youtube_music', label: 'YouTube Music', abbr: 'Ym', color: '#FF0033' },
  { key: 'youtube', label: 'YouTube', abbr: 'Yt', color: '#FF0000' },
  { key: 'boomplay', label: 'Boomplay', abbr: 'Bp', color: '#1E64FF' },
  { key: 'deezer', label: 'Deezer', abbr: 'Dz', color: '#A238FF' },
  { key: 'tidal', label: 'TIDAL', abbr: 'Ti', color: '#111111' },
  { key: 'amazon_music', label: 'Amazon Music', abbr: 'Az', color: '#25D1DA' },
  { key: 'soundcloud', label: 'SoundCloud', abbr: 'Sc', color: '#FF5500' },
  { key: 'itunes', label: 'iTunes', abbr: 'iT', color: '#EA4CC0' },
  { key: 'pandora', label: 'Pandora', abbr: 'Pa', color: '#3668FF' },
  { key: 'napster', label: 'Napster', abbr: 'Np', color: '#1B1B1B' },
  { key: 'anghami', label: 'Anghami', abbr: 'An', color: '#9B1CFF' },
  { key: 'shazam', label: 'Shazam', abbr: 'Sz', color: '#0A84FF' },
  { key: 'bandcamp', label: 'Bandcamp', abbr: 'Bc', color: '#1DA0C3' }
];

/* ---------- Social profiles ---------- */
export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', abbr: 'Ig', color: '#E1306C' },
  { key: 'tiktok', label: 'TikTok', abbr: 'Tk', color: '#111111' },
  { key: 'x', label: 'X (Twitter)', abbr: 'X', color: '#111111' },
  { key: 'facebook', label: 'Facebook', abbr: 'Fb', color: '#1877F2' },
  { key: 'youtube_channel', label: 'YouTube channel', abbr: 'Yt', color: '#FF0000' },
  { key: 'snapchat', label: 'Snapchat', abbr: 'Sn', color: '#FFD400' },
  { key: 'threads', label: 'Threads', abbr: 'Th', color: '#111111' }
];

export const RELEASE_TYPES = [
  { key: 'single', label: 'Single', filter: 'Single' },
  { key: 'ep', label: 'EP', filter: 'EPs' },
  { key: 'album', label: 'Album', filter: 'Album' }
];

export const EVENT_TYPES = ['Concert', 'Festival', 'Private event', 'Campus event', 'Appearance', 'Interview', 'Other'];

/* ---------- Editable page content ----------
   Field: { k: key, l: label, t: 'text'|'textarea'|'image'|'repeater', d: default, h: hint, items: [...] (repeater) }
   Scope 'site' saves to settings.site; every other page saves to settings.pages[slug]. */
const SERVICES = [
  { title: 'Concerts & festivals', text: 'Live sets for stages, festivals and ticketed shows, built around the energy of the room.' },
  { title: 'Private & corporate events', text: 'Performances for launches, galas, weddings, brand activations and invite-only nights.' },
  { title: 'Campus & community', text: 'Shows for universities, schools, cultural weeks, charity and community gatherings.' },
  { title: 'Media & appearances', text: 'Interviews, radio and TV spots, podcasts, features and special guest appearances.' }
];
const STEPS = [
  { title: 'Send your request', text: 'Complete the booking form with your date, city and a short description of the event.' },
  { title: 'Management reviews', text: 'The Okin Music Nation team checks availability and fit, and may follow up with questions.' },
  { title: 'Terms are agreed', text: 'Fees, logistics and requirements are set out in a written agreement.' },
  { title: 'Date confirmed', text: 'Once the agreement is in place, your booking is confirmed in writing.' }
];
const FAQ = [
  { q: 'Is submitting the form a confirmed booking?', a: 'No. The form is an enquiry only. A booking is confirmed once management accepts it in writing and the agreement is in place.' },
  { q: 'How will I hear back?', a: 'Management reviews each request and replies to the email address you provide. Complete details up front help us respond faster.' },
  { q: 'Does the form charge me anything?', a: 'No. Nothing is charged by this form. Fees and payment terms are agreed in the written agreement before a date is confirmed.' },
  { q: 'What kind of events can I request?', a: 'Concerts, festivals, private events, campus events, appearances and interviews. Choose "Other" if yours does not fit and describe it in the form.' },
  { q: 'What if my event is at short notice?', a: 'Submit as early as you can. Short-notice requests are considered where the schedule allows.' },
  { q: 'Who do I contact for press or licensing?', a: 'Use the contact page. Booking requests and general messages are handled separately.' }
];
const svc = { items: [{ k: 'title', l: 'Title', t: 'text' }, { k: 'text', l: 'Description', t: 'textarea' }] };

export const PAGES = [
  { slug: 'site', scope: 'site', title: 'Brand & bio', desc: 'Tagline, biography, artist photo and contact details used across the whole website.', fields: [
    { k: 'tagline', l: 'Tagline', t: 'textarea', d: 'Official home of Okin Vibezz: new music, visuals, press materials and bookings, all from Okin Music Nation.', h: 'Shown in the home page hero and search results.' },
    { k: 'bio_short', l: 'Short bio', t: 'textarea', d: 'Okin Vibezz is a recording artist releasing music under Okin Music Nation. This is the official home for his music, visuals, press materials and booking enquiries.', h: 'Used in the footer, press kit and about teaser.' },
    { k: 'bio_full', l: 'Full biography', t: 'textarea', d: 'Okin Vibezz is a recording artist releasing music under Okin Music Nation. This website is the official home for the music, visuals, press materials and booking enquiries.\n\nEverything published here comes directly from Okin Music Nation, so releases, photos and announcements on this site are the authoritative version. Follow the official channels for new music, and use the booking page if you would like Okin Vibezz to perform at your event.\n\nThe Okin Music Nation emblem pairs a gold ring with a rising wing. It is the mark of the label, and it sits beside every official release and announcement.', h: 'Leave a blank line between paragraphs.' },
    { k: 'artist_photo', l: 'Artist photo', t: 'image', crop: [1200, 1500], d: '', h: 'Used on the home hero, About and Press pages. Leave empty to use the built-in photo.' },
    { k: 'contact_email', l: 'Public contact email', t: 'text', d: '', h: 'Optional. Shown on the Contact page.' },
    { k: 'featured_video_id', l: 'Featured YouTube video', t: 'text', d: '', h: 'Paste a YouTube link or the 11-character video ID. It appears first on the Videos page and the home page.' }
  ] },
  { slug: 'home', title: 'Home', path: '/', desc: 'Hero, section headings, services and the closing call to action.', fields: [
    { k: 'hero_eyebrow', l: 'Hero label', t: 'text', d: 'Official website' },
    { k: 'hero_title_1', l: 'Hero title, line 1', t: 'text', d: 'Okin' },
    { k: 'hero_title_2', l: 'Hero title, line 2 (highlighted)', t: 'text', d: 'Vibezz' },
    { k: 'hero_lead', l: 'Hero text', t: 'textarea', d: '', h: 'Leave empty to use the tagline.' },
    { k: 'hero_image', l: 'Hero photo', t: 'image', crop: [1200, 1500], d: '', h: 'Leave empty to use the artist photo.' },
    { k: 'music_title', l: 'Music section title', t: 'text', d: 'Latest releases' },
    { k: 'videos_title', l: 'Videos section title', t: 'text', d: 'Videos' },
    { k: 'live_title', l: 'Live section title', t: 'text', d: 'Upcoming shows' },
    { k: 'about_title', l: 'About section title', t: 'text', d: 'Meet Okin Vibezz' },
    { k: 'services_title', l: 'Services title', t: 'text', d: 'Work with Okin' },
    { k: 'services', l: 'Services', t: 'repeater', d: SERVICES, ...svc },
    { k: 'gallery_title', l: 'Gallery section title', t: 'text', d: 'Moments & visuals' },
    { k: 'booking_title', l: 'Booking section title', t: 'text', d: 'How booking works' },
    { k: 'cta_title', l: 'Closing banner title', t: 'text', d: 'Bring Okin Vibezz to your stage' },
    { k: 'cta_text', l: 'Closing banner text', t: 'textarea', d: 'Promoters, brands and event organisers: send a booking request and management will review it.' }
  ] },
  { slug: 'music', title: 'Music', path: '/music/', desc: 'Intro text and the "where to listen" section. Releases are managed under Music.', fields: [
    { k: 'title', l: 'Page title', t: 'text', d: 'Music' },
    { k: 'lead', l: 'Intro text', t: 'textarea', d: 'Singles, EPs and albums by Okin Vibezz, released under Okin Music Nation.' },
    { k: 'listen_title', l: 'Streaming section title', t: 'text', d: 'Where to listen to Okin Vibezz' },
    { k: 'listen_text', l: 'Streaming section text', t: 'textarea', d: 'Stream and download Okin Vibezz on your favourite platform. Choose a service below.' }
  ] },
  { slug: 'videos', title: 'Videos', path: '/videos/', desc: 'Intro text. Videos are managed under Gallery.', fields: [
    { k: 'title', l: 'Page title', t: 'text', d: 'Videos' },
    { k: 'lead', l: 'Intro text', t: 'textarea', d: 'Official music videos, live sessions and behind-the-scenes clips.' }
  ] },
  { slug: 'live', title: 'Live', path: '/live/', desc: 'Intro text. Shows are managed under Live shows.', fields: [
    { k: 'title', l: 'Page title', t: 'text', d: 'Live' },
    { k: 'lead', l: 'Intro text', t: 'textarea', d: 'Upcoming concerts, festivals and appearances.' },
    { k: 'book_title', l: 'Booking section title', t: 'text', d: 'Want Okin at your event?' }
  ] },
  { slug: 'images', title: 'Images', path: '/images/', desc: 'Intro text. Photos are managed under Images & videos.', fields: [
    { k: 'title', l: 'Page title', t: 'text', d: 'Images' },
    { k: 'lead', l: 'Intro text', t: 'textarea', d: 'Official photos and visuals of Okin Vibezz. New images are added here as they are released.' }
  ] },
  { slug: 'about', title: 'About', path: '/about/', desc: 'Intro, label story and headings. The biography is edited under Brand & bio.', fields: [
    { k: 'title', l: 'Page title', t: 'text', d: 'About Okin Vibezz' },
    { k: 'lead', l: 'Intro text', t: 'textarea', d: 'The artist, the label and the official home of both.' },
    { k: 'label_title', l: 'Label section title', t: 'text', d: 'Okin Music Nation' },
    { k: 'label_text', l: 'Label section text', t: 'textarea', d: 'Okin Music Nation is the music brand Okin Vibezz releases under, and the team behind the releases, press and bookings you find on this site.\n\nIts emblem, a gold ring with a wing lifting from it, appears on official releases, artwork and announcements, so you can always tell what is genuine.' }
  ] },
  { slug: 'press', title: 'Press kit', path: '/press/', desc: 'Intro text for media and promoters.', fields: [
    { k: 'title', l: 'Page title', t: 'text', d: 'Press Kit' },
    { k: 'lead', l: 'Intro text', t: 'textarea', d: 'Official bio, photos, logos and brand colours for media, promoters and partners.' }
  ] },
  { slug: 'contact', title: 'Contact', path: '/contact/', desc: 'Intro text above the contact form.', fields: [
    { k: 'title', l: 'Page title', t: 'text', d: 'Contact' },
    { k: 'lead', l: 'Intro text', t: 'textarea', d: 'Send a message to the Okin Music Nation team. We read every one.' }
  ] },
  { slug: 'booking', title: 'Booking', path: '/booking/', desc: 'Intro, booking steps and FAQs.', fields: [
    { k: 'title', l: 'Page title', t: 'text', d: 'Book Okin Vibezz' },
    { k: 'lead', l: 'Intro text', t: 'textarea', d: 'Booking enquiries are welcome. Submitting this form is a request only: it is not a confirmed booking until management accepts it.' },
    { k: 'steps', l: 'Booking steps', t: 'repeater', d: STEPS, ...svc },
    { k: 'faq', l: 'FAQs', t: 'repeater', d: FAQ, items: [{ k: 'q', l: 'Question', t: 'text' }, { k: 'a', l: 'Answer', t: 'textarea' }] }
  ] }
];

/* Search + link-preview defaults per page. The CMS can override title, description and image for each page.
   Default share images live in /assets/og/<name>.jpg (1200 x 630). */
export const SEO_DEFAULTS = {
  home: { title: 'Okin Vibezz | Official Website', desc: 'Official website of Okin Vibezz, Okin Music Nation: music, videos, live dates, images, press kit and booking requests.' },
  music: { title: 'Music | Okin Vibezz', desc: 'Singles, EPs and albums by Okin Vibezz, released under Okin Music Nation. Stream on Spotify, Apple Music, Audiomack and more.' },
  videos: { title: 'Videos | Okin Vibezz', desc: 'Watch official videos, live sessions and behind-the-scenes clips from Okin Vibezz.' },
  live: { title: 'Live | Okin Vibezz', desc: 'Upcoming Okin Vibezz concerts, festivals and appearances, plus how to book Okin for your event.' },
  images: { title: 'Images | Okin Vibezz', desc: 'Official photos and visuals of Okin Vibezz and Okin Music Nation.' },
  about: { title: 'About | Okin Vibezz', desc: 'About Okin Vibezz and Okin Music Nation: the artist, the label and the official website.' },
  press: { title: 'Press Kit | Okin Vibezz', desc: 'Official Okin Vibezz press kit: bio, photos, logos and brand colours for media, promoters and partners.' },
  contact: { title: 'Contact | Okin Vibezz', desc: 'Contact the Okin Vibezz and Okin Music Nation team for general enquiries, press, licensing and collaborations.' },
  booking: { title: 'Book Okin Vibezz | Booking Requests', desc: 'Request Okin Vibezz for your concert, festival, private or campus event. Submit a booking enquiry to Okin Music Nation management.' }
};
export const defaultShareImage = slug => `/assets/og/${SEO_DEFAULTS[slug] || slug === 'legal' ? slug : 'default'}.jpg`;

for (const pg of PAGES) {
  if (pg.scope === 'site') continue;
  const d = SEO_DEFAULTS[pg.slug];
  pg.seo = true;
  pg.fields.push(
    { k: 'seo_title', l: 'Search title', t: 'text', d: '', g: 'seo', h: `Shown in Google results and browser tabs. Default: ${d.title}`, ph: d.title },
    { k: 'seo_description', l: 'Search description', t: 'textarea', d: '', g: 'seo', h: 'Keep it under 160 characters.', ph: d.desc },
    { k: 'og_image', l: 'Link preview image', t: 'image', crop: [1200, 630], d: '', g: 'seo', h: 'Shown when this page is shared on WhatsApp, Facebook, X, iMessage and more. Cropped to 1200 x 630 automatically. Leave empty to use the built-in branded card.' }
  );
}

export const LEGAL_SLUGS = ['privacy-policy', 'terms-of-use', 'cookie-policy', 'copyright-and-music-rights', 'booking-terms', 'disclaimer', 'accessibility-statement'];

/* Defaults lookup: DEFAULTS.home.hero_title_1 etc. */
export const DEFAULTS = Object.fromEntries(PAGES.map(p => [p.slug, Object.fromEntries(p.fields.map(f => [f.k, f.d]))]));

/* Brand-colour helpers shared by site and CMS */
export const textOn = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#12121a' : '#ffffff'; };
export const YT_ID = /^[\w-]{11}$/;
export function parseYouTube(input) {
  const v = String(input || '').trim();
  if (YT_ID.test(v)) return v;
  try { const u = new URL(v); if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).slice(0, 11); const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop(); return YT_ID.test(id || '') ? id : ''; } catch { return ''; }
}
export const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
