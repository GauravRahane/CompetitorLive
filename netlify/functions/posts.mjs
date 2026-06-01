// ── GET /api/posts ─────────────────────────────────────────────────────────
// Returns official posts from Supabase. Frontend polls this every 30 seconds.
// Query params:
//   ?competitor=HEFT          filter by competitor
//   ?category=New+Equipment   filter by category
//   ?since=ISO_DATE           only posts fetched after this timestamp (for incremental updates)
//   ?limit=50                 max results (default 50)

import { supabase, COMPETITORS } from './shared.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const competitor = url.searchParams.get('competitor');
  const category   = url.searchParams.get('category');
  const since      = url.searchParams.get('since');
  const limit      = parseInt(url.searchParams.get('limit') || '50');

  let query = supabase
    .from('posts')
    .select('*')
    .eq('is_official', true)
    .order('fetched_at', { ascending: false })
    .limit(limit);

  if (competitor) query = query.eq('competitor', competitor);
  if (category)   query = query.eq('category', category);
  if (since)      query = query.gt('fetched_at', since);

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders()
    });
  }

  // Attach competitor style info for the frontend
  const styled = (data || []).map(post => {
    const comp = COMPETITORS.find(c => c.name === post.competitor) || {};
    return {
      ...post,
      color: comp.color || '#1D6FD8',
      initials: comp.initials || '??'
    };
  });

  return new Response(JSON.stringify(styled), {
    status: 200,
    headers: corsHeaders()
  });
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store'
  };
}

export const config = { path: '/api/posts' };
