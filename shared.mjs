// ── Shared config used by all Netlify functions ───────────────────────────────

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ── Supabase client ───────────────────────────────────────────────────────────
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // use service key (bypasses Row Level Security)
);

// ── Anthropic client ──────────────────────────────────────────────────────────
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ── Competitors to monitor ────────────────────────────────────────────────────
export const COMPETITORS = [
  {
    name: 'HEFT',
    linkedinUrl: process.env.HEFT_LINKEDIN_URL,
    color: '#1D6FD8',
    initials: 'HE'
  },
  {
    name: 'Amrik Singh and Sons',
    linkedinUrl: process.env.AMRIK_LINKEDIN_URL,
    color: '#0FA87E',
    initials: 'AS'
  },
  {
    name: 'Barkat Cranes',
    linkedinUrl: process.env.BARKAT_LINKEDIN_URL,
    color: '#E08C1A',
    initials: 'BC'
  }
];

// ── Post categories ───────────────────────────────────────────────────────────
export const CATEGORIES = [
  'New Equipment', 'Project Win', 'Expansion',
  'Tender / Bid', 'Partnership', 'Milestone', 'Certification', 'Other'
];

// ── Claude AI classifier ──────────────────────────────────────────────────────
export async function classifyPost(post) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You monitor crane and heavy equipment company LinkedIn posts for a competitor intelligence portal.

Classify if this is an OFFICIAL UPDATE worth tracking.

OFFICIAL = new equipment purchase/arrival, project win, contract award, expansion,
           tender/bid, partnership, milestone, certification, new branch/office.
SKIP = motivational quotes, general industry news, reposts, festive greetings,
       generic company culture posts, job postings.

Competitor: ${post.competitor}
Post text: "${post.text}"

Reply ONLY with this JSON (no extra text, no markdown):
{
  "isOfficial": true or false,
  "category": "one of: ${CATEGORIES.join(', ')}",
  "summary": "one concise sentence describing the update"
}`
      }]
    });

    const result = JSON.parse(msg.content[0].text.trim());
    return {
      ...post,
      is_official: result.isOfficial,
      category: result.category || 'Other',
      summary: result.summary || post.text.slice(0, 150)
    };
  } catch (err) {
    console.error('[Classifier] Error:', err.message);
    return { ...post, is_official: false, category: 'Other', summary: '' };
  }
}

// ── Apify scraper ─────────────────────────────────────────────────────────────
export async function scrapeLinkedIn(competitor) {
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/scrapio~linkedin-post-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: competitor.linkedinUrl }],
          maxPosts: 15
        }),
        signal: AbortSignal.timeout(110000) // 110s timeout (Netlify functions max 120s)
      }
    );

    const items = await response.json();
    return (items || []).map(item => ({
      id: `${competitor.name}-${item.id || item.postUrl || item.url}`
            .replace(/[^a-zA-Z0-9-_]/g, '_')
            .slice(0, 200),
      competitor: competitor.name,
      text: item.text || item.commentary || '',
      post_url: item.postUrl || item.url || '',
      posted_at: item.postedAt || item.date || new Date().toISOString()
    }));
  } catch (err) {
    console.error(`[Scraper] Failed for ${competitor.name}:`, err.message);
    return [];
  }
}
