// ── GET /api/stats ─────────────────────────────────────────────────────────
// Returns total post counts per competitor and last poll timestamp.

import { supabase } from './shared.mjs';

export default async (req) => {
  // Counts are per-stream. Previously everything was lumped together, so the
  // "Total" badge included ground posts.
  const countIn = async (stream) => {
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_official', true)
      .eq('stream', stream);
    return count || 0;
  };

  const [competitorTotal, groundTotal] = await Promise.all([
    countIn('competitor'),
    countIn('ground')
  ]);

  // Per-competitor and per-voice breakdowns, each scoped to its own stream.
  const [{ data: compRows }, { data: groundRows }] = await Promise.all([
    supabase.from('posts').select('competitor')
      .eq('is_official', true).eq('stream', 'competitor'),
    supabase.from('posts').select('source')
      .eq('is_official', true).eq('stream', 'ground')
  ]);

  const byCompetitor = {};
  (compRows || []).forEach(r => {
    byCompetitor[r.competitor] = (byCompetitor[r.competitor] || 0) + 1;
  });

  const bySource = {};
  (groundRows || []).forEach(r => {
    if (r.source) bySource[r.source] = (bySource[r.source] || 0) + 1;
  });

  // Ground posts from the last 7 days, for the "This Week" metric.
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const { count: groundWeek } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('is_official', true).eq('stream', 'ground')
    .gte('posted_at', weekAgo);

  const { data: lastPoll } = await supabase
    .from('poll_log')
    .select('run_at, new_posts')
    .order('run_at', { ascending: false })
    .limit(1)
    .single();

  return new Response(JSON.stringify({
    totalPosts: competitorTotal,     // competitor stream only
    byCompetitor,
    groundTotal,
    bySource,
    groundWeek: groundWeek || 0,
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
