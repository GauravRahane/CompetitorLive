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
  },
  {
    name: 'Lakhwinderjeet Singh',
    linkedinUrl: process.env.GROUND_LAKHWINDERJEET_LINKEDIN_URL,
    role: 'Crane Operator',
    color: '#7B3FA0',
    initials: 'LS'
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

// ── Batched scraping ──────────────────────────────────────────────────────────
// Apify bills per RUN, not per post, so one run with 5 URLs costs the same as
// one run with 1. Batching every target that shares an actor takes a scan from
// 9 runs to 2. Posts come back mixed together, so each one is matched back to
// its target by the author's profile/company URL.

const slugOf = (url) => {
  const m = String(url || '').match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i);
  return m ? m[1].toLowerCase() : null;
};

// Find which target an item belongs to. Actors differ in where they put the
// author URL, so check the known shapes, then fall back to scanning the item.
function matchTarget(item, bySlug) {
  const candidates = [
    item.author?.linkedinUrl, item.author?.url, item.author?.profileUrl,
    item.authorUrl, item.profileUrl, item.targetUrl, item.inputUrl,
    item.company?.linkedinUrl, item.authorProfileUrl
  ];
  for (const c of candidates) {
    const t = bySlug.get(slugOf(c));
    if (t) return t;
  }
  // Last resort: the slug appears somewhere in the serialised item.
  const blob = JSON.stringify(item).toLowerCase();
  for (const [slug, t] of bySlug) {
    if (slug && blob.includes('/' + slug)) return t;
  }
  return null;
}

function actorConfigFor(target) {
  const isGround = target.stream === 'ground'
    || /linkedin\.com\/in\//i.test(target.linkedinUrl);
  const actorRaw = target.actor || (isGround
    ? (process.env.APIFY_PROFILE_ACTOR || 'A3cAPGpwBEG8RJwse')
    : (process.env.APIFY_COMPANY_ACTOR || 'buIWk2uOUzTmcLsuB'));
  return {
    actor: actorRaw.includes('/') ? actorRaw.replace('/', '~') : actorRaw,
    inputKey: target.inputKey || (isGround
      ? (process.env.APIFY_PROFILE_INPUT_KEY || 'targetUrls')
      : (process.env.APIFY_COMPANY_INPUT_KEY || 'targetUrls')),
    maxPosts: Number(target.maxPosts ?? (isGround
      ? (process.env.GROUND_MAX_POSTS || 3)
      : (process.env.COMPANY_MAX_POSTS || 3))),
    isGround
  };
}

const mapItem = (item, target) => ({
  id: `${target.name}-${item.id}`.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 200),
  competitor: target.name,
  text: item.content || '',
  post_url: item.linkedinUrl || '',
  posted_at: item.postedAt?.date || new Date().toISOString(),
  image_url: extractImageUrl(item)
});

/**
 * Scrape many targets in as few Apify runs as possible.
 * Returns a Map of target name → posts[].
 */
export async function scrapeBatch(targets) {
  const out = new Map(targets.map(t => [t.name, []]));

  const valid = targets.filter(t => {
    if (!t.linkedinUrl || !/^https?:\/\//i.test(t.linkedinUrl)) {
      console.error(`[Scraper] SKIPPED ${t.name}: linkedinUrl is ${JSON.stringify(t.linkedinUrl)}`);
      return false;
    }
    return true;
  });
  if (!valid.length) return out;

  // Group by actor + input field + maxPosts — one run per distinct combination.
  const groups = new Map();
  for (const t of valid) {
    const c = actorConfigFor(t);
    const key = `${c.actor}|${c.inputKey}|${c.maxPosts}`;
    if (!groups.has(key)) groups.set(key, { cfg: c, targets: [] });
    groups.get(key).targets.push(t);
  }

  await Promise.all([...groups.values()].map(async ({ cfg, targets: group }) => {
    const urls = group.map(t => t.linkedinUrl);
    const bySlug = new Map(group.map(t => [slugOf(t.linkedinUrl), t]));

    console.log(`[Scraper] batch → actor=${cfg.actor} input={${cfg.inputKey}} ` +
                `maxPosts=${cfg.maxPosts} urls=${urls.length} ` +
                `(${group.map(t => t.name).join(', ')})`);

    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${cfg.actor}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [cfg.inputKey]: urls, maxPosts: cfg.maxPosts }),
          signal: AbortSignal.timeout(110000)
        }
      );
      const items = await res.json();

      if (!Array.isArray(items) || !items.length) {
        console.warn(`[Scraper] batch returned 0 items from ${cfg.actor}`,
          Array.isArray(items) ? '' : JSON.stringify(items).slice(0, 250));
        return;
      }
      console.log(`[Scraper] batch got ${items.length} items; keys: ${Object.keys(items[0]).join(', ')}`);

      let unmatched = 0;
      for (const item of items) {
        const t = matchTarget(item, bySlug);
        if (!t) { unmatched++; continue; }
        out.get(t.name).push(mapItem(item, t));
      }
      if (unmatched) {
        console.warn(`[Scraper] ${unmatched} item(s) could not be matched to a target ` +
          `— author URL field may differ. Sample: ${JSON.stringify(items[0]).slice(0, 300)}`);
      }
      for (const t of group) {
        console.log(`[Scraper] ${t.name}: ${out.get(t.name).length} posts`);
      }
    } catch (e) {
      console.error(`[Scraper] batch failed for ${cfg.actor}:`, e.message);
    }
  }));

  return out;
}

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
    ? (process.env.APIFY_PROFILE_ACTOR || 'A3cAPGpwBEG8RJwse')  // profile-posts actor
    : (process.env.APIFY_COMPANY_ACTOR || 'buIWk2uOUzTmcLsuB'));

  // Apify's API wants `username~actor-name`, not `username/actor-name`.
  // A bare 17-char actor ID passes through untouched.
  const actor = actorRaw.includes('/') ? actorRaw.replace('/', '~') : actorRaw;

  // Each actor names its input field differently.
  const inputKey = competitor.inputKey || (isGround
    ? (process.env.APIFY_PROFILE_INPUT_KEY || 'targetUrls')
    : (process.env.APIFY_COMPANY_INPUT_KEY || 'targetUrls'));

  // Pricing is per run, not per post, so pulling fewer posts saves nothing.
  // 3 for both streams; override per stream with the env vars if that changes.
  const maxPosts = Number(
    competitor.maxPosts ?? (isGround
      ? (process.env.GROUND_MAX_POSTS  || 3)
      : (process.env.COMPANY_MAX_POSTS || 3))
  );

  const input = { [inputKey]: [competitor.linkedinUrl], maxPosts };

  console.log(`[Scraper] ${competitor.name} → actor=${actor} ` +
              `input={${inputKey}} maxPosts=${maxPosts} stream=${isGround ? 'ground' : 'competitor'}`);

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
