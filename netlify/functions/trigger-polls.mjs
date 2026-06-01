// ── POST /api/poll ─────────────────────────────────────────────────────────
// Manually triggers an immediate scrape + classify cycle.
// Useful for testing without waiting for the scheduler.
// Protected by a simple secret header so only you can trigger it.

import { supabase, COMPETITORS, scrapeLinkedIn, classifyPost } from './shared.mjs';

export default async (req) => {
  // Basic auth check — requires X-Poll-Secret header matching your env var
  const secret = req.headers.get('x-poll-secret');
  if (process.env.POLL_SECRET && secret !== process.env.POLL_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let totalNew = 0;
  const results = [];

  for (const competitor of COMPETITORS) {
    const posts = await scrapeLinkedIn(competitor);
    let newForComp = 0;

    for (const post of posts) {
      if (!post.text || post.text.length < 20) continue;

      const { data: existing } = await supabase
        .from('posts')
        .select('id')
        .eq('id', post.id)
        .single();

      if (existing) continue;

      const classified = await classifyPost(post);

      await supabase.from('posts').insert({
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

      if (classified.is_official) {
        newForComp++;
        totalNew++;
      }
    }

    results.push({ competitor: competitor.name, checked: posts.length, newOfficial: newForComp });
  }

  await supabase.from('poll_log').insert({
    run_at: new Date().toISOString(),
    new_posts: totalNew,
    status: 'manual'
  });

  return new Response(JSON.stringify({ totalNew, results }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*'
    }
  });
};

export const config = { path: '/api/poll' };
