// Default legal copy. Override any page from the Supabase `pages` table (slug = key).
// This is practical draft text, not legal advice: have a qualified professional review it before launch.
const S = 'Okin Vibezz';
export const LEGAL = {
  'privacy-policy': ['Privacy Policy', [
    ['Who we are', [`This website is operated by Okin Music Nation on behalf of ${S}. This policy explains what personal information the site collects, why, and what choices you have.`]],
    ['What we collect', ['We collect only what you choose to send through the contact and booking forms: your name, email address, and the details of your message or event (such as date, venue, city, budget and description). Phone number and organisation are optional.', 'To limit spam we store a one-way hash of your network address alongside each submission. We do not store the address itself.']],
    ['How we use it', ['We use this information only to read and reply to your message or to assess your booking request. We do not sell it, rent it, or use it for advertising.']],
    ['Who can see it', ['Submissions are visible only to authorised Okin Music Nation management. Our hosting and database providers (Netlify and Supabase) process data on our behalf under their own security commitments. If email notifications are enabled, a short summary may also be sent to management by an email delivery provider.']],
    ['How long we keep it', ['We keep enquiries for as long as needed to respond and to keep a reasonable record of bookings, and then delete them. You can ask us to delete your submission earlier at any time.']],
    ['Your rights', ['Depending on where you live, you may have the right to access, correct, delete or restrict the use of your personal information, and to object to its use. To exercise any of these rights, contact us through the contact page and we will respond within a reasonable time.']],
    ['Third-party content', ['Videos load only after you press play, using the privacy-enhanced YouTube domain. Links to streaming services and social networks leave this site and are governed by those services\u2019 own privacy policies.']],
    ['Changes', ['We may update this policy as the site grows. The current version is always published on this page.']]
  ]],
  'terms-of-use': ['Terms of Use', [
    ['Acceptance', [`By using this website you agree to these terms. If you do not agree, please do not use the site.`]],
    ['Acceptable use', ['You agree to use the site lawfully. You must not scrape it at scale, attempt to disrupt it or access areas that are not public, submit false or abusive messages, or use the forms to send spam or unsolicited advertising.']],
    ['Content and ownership', [`The music, artwork, photographs, video, logos and text on this site belong to ${S}, Okin Music Nation or their licensors. See the Copyright and Music Rights page for what you may and may not do with them.`]],
    ['Third-party links', ['The site links to streaming platforms, social networks and other services we do not control. We are not responsible for their content or practices.']],
    ['No warranty', ['The site is provided as is. We work to keep it accurate and available but do not guarantee it will be uninterrupted or error-free.']],
    ['Limitation of liability', ['To the extent permitted by law, Okin Music Nation is not liable for indirect or consequential loss arising from your use of the site.']],
    ['Changes and contact', ['We may update these terms from time to time. Questions can be sent through the contact page.']]
  ]],
  'cookie-policy': ['Cookie Policy', [
    ['Our approach', ['This website does not use advertising cookies, tracking pixels or third-party analytics.']],
    ['What may be stored', ['Your browser may keep ordinary technical data needed to load the site quickly, such as cached files. Nothing is stored to identify or follow you across other websites.']],
    ['Embedded video', ['Videos are not loaded until you press play. When you do, the video is served from YouTube\u2019s privacy-enhanced domain (youtube-nocookie.com), which may set its own cookies once playback starts.']],
    ['If this changes', ['If we ever add analytics or other optional cookies, we will update this policy and add a consent control before they are switched on.']]
  ]],
  'copyright-and-music-rights': ['Copyright and Music Rights', [
    ['Ownership', [`All music, recordings, lyrics, artwork, photographs, video and branding on this site, including the Okin Music Nation emblem, are protected by copyright and trademark law and belong to ${S}, Okin Music Nation or their licensors.`]],
    ['What you may do', ['You may share links to this site and to official releases, and quote short excerpts of our text with credit and a link back. Journalists and event promoters may use the official materials in the Press Kit to promote Okin Vibezz.']],
    ['What you may not do', ['Do not copy, upload, sample, remix, re-record, or redistribute any music, artwork or video, or use the name or logo in a way that suggests endorsement, without written permission.']],
    ['Licensing and takedowns', ['For sync, sampling, broadcast or other licensing requests, or to report suspected infringement, contact us through the contact page with details of the work and where it appears.']]
  ]],
  'booking-terms': ['Booking Terms', [
    ['Requests are enquiries', ['Submitting the booking form is a request only. A booking is not confirmed until Okin Music Nation management accepts it in writing.']],
    ['What happens next', ['Management reviews each request and replies to the email address you provide. We may ask follow-up questions about the event, venue, schedule and technical requirements.']],
    ['Fees and agreement', ['Availability, fees, travel and accommodation, technical and hospitality requirements, payment schedule, cancellation and rescheduling are agreed in a separate written agreement before a date is confirmed.']],
    ['Your reference number', ['After you submit, you receive a reference starting with OKV. Quote it in any follow-up so we can find your request quickly.']],
    ['Accuracy', ['Please give accurate event details. Requests with missing or misleading information may be declined.']]
  ]],
  'disclaimer': ['Disclaimer', [
    ['General information', ['The information on this site is provided in good faith for general purposes. We do not guarantee that it is complete, accurate or current, including release dates, availability and event details.']],
    ['External services', ['Streaming platforms, social networks and other external sites are run by third parties with their own terms and policies. We are not responsible for them.']],
    ['No professional advice', ['Nothing on this site is legal, financial or professional advice.']]
  ]],
  'accessibility-statement': ['Accessibility Statement', [
    ['Our commitment', ['We want everyone to be able to use this website. We build it with semantic HTML, keyboard-friendly navigation, visible focus states, readable colour contrast, text alternatives for images, and support for reduced-motion preferences.']],
    ['Known limitations', ['Some third-party content, such as embedded video, may not meet the same standards. The artist photography on the site is described in text, but we are still improving descriptions as new media is added.']],
    ['Feedback', ['If you meet a barrier on this site, tell us through the contact page with the page address and what went wrong. We will work to fix it and offer an alternative way to get the information you need.']]
  ]]
};

/* Body markup used by CMS-edited legal pages:
   "## Heading" starts a section, "- item" makes a list, blank lines separate paragraphs. */
export const legalToMarkup = slug => (LEGAL[slug]?.[1] || []).map(([h, ps]) => `## ${h}\n\n${ps.join('\n\n')}`).join('\n\n');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderBody(text) {
  const out = []; let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`); list = []; } };
  for (const block of String(text || '').replace(/\r/g, '').split(/\n{2,}/)) {
    for (const line of block.split('\n')) {
      const t = line.trim(); if (!t) continue;
      if (t.startsWith('## ')) { flush(); out.push(`<h2>${esc(t.slice(3))}</h2>`); }
      else if (t.startsWith('- ')) list.push(t.slice(2));
      else { flush(); out.push(`<p>${esc(t)}</p>`); }
    }
    flush();
  }
  return out.join('');
}

/* Search/link-preview descriptions for the legal pages */
export const LEGAL_DESC = {
  'privacy-policy': 'How Okin Vibezz and Okin Music Nation collect, use and protect the information you send through this website.',
  'terms-of-use': 'The terms for using the Okin Vibezz website, including acceptable use, content ownership and liability.',
  'cookie-policy': 'This website uses no advertising cookies or trackers. Read what is stored and how video embeds behave.',
  'copyright-and-music-rights': 'Who owns the music, artwork and branding on this site, what you may share, and how to request permission.',
  'booking-terms': 'How Okin Vibezz booking requests work: requests are enquiries, how management replies, and how a date is confirmed.',
  'disclaimer': 'General information disclaimer for the Okin Vibezz website, covering accuracy, external links and advice.',
  'accessibility-statement': 'Our commitment to an accessible Okin Vibezz website, known limitations and how to report a barrier.'
};
