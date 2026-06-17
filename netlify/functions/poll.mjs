// ── Netlify Scheduled Function ─────────────────────────────────────────────
// Runs once daily at 9am IST (3:30am UTC) via Netlify's scheduler.
// Scrapes each competitor's LinkedIn, classifies with Claude, saves new posts to Supabase.

import { schedule } from '@netlify/functions';
import { supabase, COMPETITORS, scrapeLinkedIn, classifyPost } from './shared.mjs';

const handler = async (event) => {
  console.log(`[Poll] Started at ${new Date().toISOString()}`);
  let totalNew = 0;

  for (const competitor of COMPETITORS) {
    console.log(`[Poll] Checking ${competitor.name}...`);

    // 1. Scrape latest posts from LinkedIn via Apify
    const posts = await scrapeLinkedIn(competitor);
    console.log(`[Poll] Got ${posts.length} posts from ${competitor.name}`);

    for (const post of posts) {
      if (!post.text || post.text.length < 20) continue;

      // 2. Check if we've already seen this post (by unique ID)
      const { data: existing } = await supabase
        .from('posts')
        .select('id')
        .eq('id', post.id)
        .single();

      if (existing) continue; // already processed — skip

      // 3. Classify with Claude
      const classified = await classifyPost(post);

      // 4. Save to Supabase regardless (so we never re-process it)
      const { error } = await supabase.from('posts').insert({
        id: classified.id,
        competitor: classified.competitor,
        text: classified.text,
        summary: classified.summary,
        category: classified.category,
        posted_at: classified.posted_at,
        post_url: classified.post_url,
        is_official: classified.is_official,
        fetched_at: new Date().toISOString()
      });

      if (error) {
        console.error('[DB] Insert error:', error.message);
        continue;
      }

      if (classified.is_official) {
        totalNew++;
        console.log(`[New] ${classified.competitor} — ${classified.category}: ${classified.summary}`);
      }
    }
  }

  // 5. Log this poll run to Supabase
  await supabase.from('poll_log').insert({
    run_at: new Date().toISOString(),
    new_posts: totalNew,
    status: 'success'
  });

  console.log(`[Poll] Done. ${totalNew} new official updates saved.`);
  return { statusCode: 200 };
};

// Runs once daily at 9am IST (3:30am UTC)
export default schedule('30 3 * * *', handler);
