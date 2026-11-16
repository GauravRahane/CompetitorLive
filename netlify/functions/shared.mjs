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
// ── Ground Insights: tracked field voices ─────────────────────────────────────
// Personal LinkedIn profiles. `name` MUST match the key in GROUND_SOURCES in
// portal/index.html, or the portal filters the post out.
export const GROUND_VOICES = [
  {
    name: 'Rakesh Kumar',
    linkedinUrl: process.env.GROUND_RAKESH_LINKEDIN_URL,
    role: 'Heavy Lift Crane Operator',
    color: '#C0392B',
    initials: 'RK'
  },
  {
    name: 'Deepak Kamath',
    linkedinUrl: process.env.GROUND_DEEPAK_LINKEDIN_URL,
    role: 'Heavy Lift Crane Operator',
    color: '#1A56A0',
    initials: 'DK'
  },
  {
    name: 'Gurpreet',
    linkedinUrl: process.env.GROUND_GURPREET_LINKEDIN_URL,
    role: 'Heavy Lift Crane Operator',
    color: '#1E7C4A',
    initials: 'GS'
  }
];

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
  if (!competitor.linkedinUrl || !/^https?:\/\//i.test(competitor.linkedinUrl)) {
    console.error(`[Scraper] SKIPPED ${competitor.name}: linkedinUrl is ${JSON.stringify(competitor.linkedinUrl)}`);
    return [];
  }

  // Company pages and personal profiles use different Apify actors.
  // A target can override either value; otherwise we fall back to env vars.
  const isGround = competitor.stream === 'ground'
    || /linkedin\.com\/in\//i.test(competitor.linkedinUrl);

  const actorRaw = competitor.actor || (isGround
    ? (process.env.APIFY_PROFILE_ACTOR || 'harvestapi/linkedin-profile-posts')
    : (process.env.APIFY_COMPANY_ACTOR || 'buIWk2uOUzTmcLsuB'));

  // Apify's API wants `username~actor-name`, not `username/actor-name`.
  // A bare 17-char actor ID passes through untouched.
  const actor = actorRaw.includes('/') ? actorRaw.replace('/', '~') : actorRaw;

  // Each actor names its input field differently.
  const inputKey = competitor.inputKey || (isGround
    ? (process.env.APIFY_PROFILE_INPUT_KEY || 'profileUrls')
    : 'targetUrls');

  const input = { [inputKey]: [competitor.linkedinUrl], maxPosts: 5 };

  console.log(`[Scraper] ${competitor.name} → actor=${actor} input={${inputKey}}`);

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(110000) // 110s timeout (Netlify functions max 120s)
      }
    );
const items = await response.json();

    if (!Array.isArray(items) || items.length === 0) {
      console.warn(`[Scraper] 0 items for ${competitor.name} via ${actor} ` +
        `using {${inputKey}} — ${competitor.linkedinUrl}`,
        Array.isArray(items) ? '' : JSON.stringify(items).slice(0, 250));
      return [];
    }
    if (!items[0].content) {
      console.warn(`[Scraper] ${competitor.name}: no "content" field from ${actor}. ` +
        `Keys: ${Object.keys(items[0]).join(', ')}`);
    }
    console.log(`[Scraper] ${competitor.name} first-item keys: ${Object.keys(items[0]).join(', ')}`);

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
