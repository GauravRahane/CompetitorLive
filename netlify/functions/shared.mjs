// ── Shared config used by all Netlify functions ───────────────────────────────

import { createClient } from '@supabase/supabase-js';

// ── Supabase client ───────────────────────────────────────────────────────────
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // use service key (bypasses Row Level Security)
);

// ── Competitors to monitor ────────────────────────────────────────────────────
export const COMPETITORS = [
  {
    name: 'PHL',
    linkedinUrl: process.env.PHL_LINKEDIN_URL,
    color: '#1D6FD8',
    initials: 'PH'
  },
  {
    name: 'Tarachand',
    linkedinUrl: process.env.TARA_LINKEDIN_URL,
    color: '#0FA87E',
    initials: 'TC'
  },
  {
    name: 'HEFT',
    linkedinUrl: process.env.HEFT_LINKEDIN_URL,
    color: '#E08C1A',
    initials: 'HE'
  },
  {
    name: 'Ratnesh Singh Stellar Infra',
    linkedinUrl: process.env.STELLAR_LINKEDIN_URL,
    color: '#C0392B',
    initials: 'RS'
  },
  {
    name: 'AS Cranes',
    linkedinUrl: process.env.AS_CRANES_LINKEDIN_URL,
    color: '#5A4FCF',
    initials: 'AS'
  }
];

// ── Post categories ───────────────────────────────────────────────────────────
export const CATEGORIES = [
  'New Equipment', 'Project Win', 'Expansion',
  'Tender / Bid', 'Partnership', 'Milestone', 'Certification', 'Other'
];

// ── Post Classifier (No AI Alternative) ───────────────────────────────────────
// Marks every post as official and maps default values
export function classifyPost(post) {
  return {
    ...post,
    is_official: true,
    category: 'Update',
    summary: post.text?.slice(0, 200) || ''
  };
}

// ── Image extractor ───────────────────────────────────────────────────────────
// LinkedIn post scrapers return the post image under many different field names
// depending on whether the post is an image / video / article / document.
// This tries every known shape and returns the first valid http(s) URL, or null.
function extractImageUrl(item) {
  if (!item || typeof item !== 'object') return null;

  const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

  // Pull a URL out of a value that might be a string or an object with a url-ish key.
  const fromEntry = (e) => {
    if (isUrl(e)) return e;
    if (e && typeof e === 'object') {
      return (
        [e.url, e.imageUrl, e.image, e.src, e.thumbnail, e.thumbnailUrl]
          .find(isUrl) ||
        (e.image && typeof e.image === 'object' ? fromEntry(e.image) : null)
      );
    }
    return null;
  };

  // Array fields: take the first entry that yields a URL.
  const arrayFields = ['postImages', 'images', 'media', 'attachments', 'imageUrls'];
  for (const key of arrayFields) {
    const arr = item[key];
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        const u = fromEntry(entry);
        if (u) return u;
      }
    }
  }

  // Single-value fields.
  const singleFields = [
    'image', 'imageUrl', 'mainImage', 'thumbnail', 'thumbnailUrl', 'postImage',
  ];
  for (const key of singleFields) {
    const u = fromEntry(item[key]);
    if (u) return u;
  }

  return null;
}

// ── Apify scraper ─────────────────────────────────────────────────────────────
// Actor: buIWk2uOUzTmcLsuB (LinkedIn Post Search Scraper — no cookies required)
export async function scrapeLinkedIn(competitor) {
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/buIWk2uOUzTmcLsuB/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorUrls: [competitor.linkedinUrl],
          maxPosts: 5
        }),
        signal: AbortSignal.timeout(110000) // 110s timeout (Netlify functions max 120s)
      }
    );
const items = await response.json();

return (items || []).map(item => ({
  id: `${competitor.name}-${item.id}`
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 200),
  competitor: competitor.name,
  text: item.content || '',
  post_url: item.linkedinUrl || '',
  posted_at: item.postedAt?.date || new Date().toISOString(),
  image_url: extractImageUrl(item)
}));
  } catch (err) {
    console.error(`[Scraper] Failed for ${competitor.name}:`, err.message);
    return [];
  }
}
