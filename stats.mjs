// ── GET /api/stats ─────────────────────────────────────────────────────────
// Returns total post counts per competitor and last poll timestamp.

import { supabase } from './shared.mjs';

export default async (req) => {
  // Total official posts
  const { count: totalPosts } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('is_official', true);

  // Per-competitor counts
  const { data: byCompetitor } = await supabase
    .from('posts')
    .select('competitor')
    .eq('is_official', true);

  const counts = {};
  (byCompetitor || []).forEach(row => {
    counts[row.competitor] = (counts[row.competitor] || 0) + 1;
  });

  // Last poll run
  const { data: lastPoll } = await supabase
    .from('poll_log')
    .select('run_at, new_posts')
    .order('run_at', { ascending: false })
    .limit(1)
    .single();

  return new Response(JSON.stringify({
    totalPosts: totalPosts || 0,
    byCompetitor: counts,
    lastPoll: lastPoll?.run_at || null,
    newInLastPoll: lastPoll?.new_posts || 0
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
      'Cache-Control': 'no-store'
    }
  });
};

export const config = { path: '/api/stats' };
