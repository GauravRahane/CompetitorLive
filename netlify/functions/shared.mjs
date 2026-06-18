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
    
// ← ADD THIS LINE (outside the map)
if (items?.[0]) console.log('[Apify fields]', Object.keys(items[0]));

return (items || []).map(item => ({
  id: `${competitor.name}-${item.id}`
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 200),
  competitor: competitor.name,
  text: item.content || '',
  post_url: item.linkedinUrl || '',
  posted_at: item.postedAt?.date || new Date().toISOString(),
  image_url: item.images?.[0] || item.image || item.imgUrl || null
}));
  } catch (err) {
    console.error(`[Scraper] Failed for ${competitor.name}:`, err.message);
    return [];
  }
}
