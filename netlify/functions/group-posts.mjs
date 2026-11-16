// ── GET /api/group-posts ──────────────────────────────────────────────────────
// Serves the team's shared LinkedIn posts from Supabase (table: group_posts).
//
//   ?category=Projects      Projects | People | Competitor
//   ?sharedBy=Rishi Sanghvi
//   ?q=adani                full-text search across body + author
//   ?limit=36&offset=0      paging
//   ?facets=1               also return counts per category and per sharer
//
// Filtering and paging happen in the database, so the browser never downloads
// the whole archive.

import { supabase } from './shared.mjs';

export default async (req) => {
  const u        = new URL(req.url);
  const category = u.searchParams.get('category');
  const sharedBy = u.searchParams.get('sharedBy');
  const q        = (u.searchParams.get('q') || '').trim();
  const limit    = Math.min(parseInt(u.searchParams.get('limit') || '36'), 200);
  const offset   = parseInt(u.searchParams.get('offset') || '0');
  const facets   = u.searchParams.get('facets') === '1';

  const applyFilters = (query) => {
    if (category) query = query.eq('category', category);
    if (sharedBy) query = query.eq('shared_by', sharedBy);
    if (q)        query = query.or(`body.ilike.%${q}%,author.ilike.%${q}%,shared_by.ilike.%${q}%`);
    return query;
  };

  let query = supabase
    .from('group_posts')
    .select('id,category,shared_by,shared_on,author,headline,posted_at,abstract,body,post_url',
            { count: 'exact' })
    .order('posted_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await applyFilters(query);

  if (error) {
    return json({ error: error.message }, 500);
  }

  const payload = {
    total: count ?? 0,
    offset,
    limit,
    posts: (data || []).map(r => ({
      id: r.id,
      category: r.category,
      sharedBy: r.shared_by,
      sharedOn: r.shared_on,
      author: r.author,
      headline: r.headline,
      postedAt: r.posted_at,
      abstract: r.abstract,
      text: r.body,
      url: r.post_url
    }))
  };

  // Facet counts respect the *other* active filters, so the category cards
  // re-count when a sharer is selected (and vice versa).
  if (facets) {
    const [cats, sharers] = await Promise.all([
      countBy('category', { sharedBy, q }),
      countBy('shared_by', { category, q })
    ]);
    payload.facets = { categories: cats, sharers };
  }

  return json(payload);
};

// Supabase has no GROUP BY in the JS client, so count each value with a
// head-only query. Cheap: no rows are transferred, just counts.
async function countBy(column, { category, sharedBy, q }) {
  const values = column === 'category'
    ? ['Projects', 'People', 'Competitor']
    : await distinctSharers();

  const counts = {};
  await Promise.all(values.map(async (v) => {
    let query = supabase.from('group_posts').select('id', { count: 'exact', head: true }).eq(column, v);
    if (category && column !== 'category')  query = query.eq('category', category);
    if (sharedBy && column !== 'shared_by') query = query.eq('shared_by', sharedBy);
    if (q) query = query.or(`body.ilike.%${q}%,author.ilike.%${q}%,shared_by.ilike.%${q}%`);
    const { count } = await query;
    counts[v] = count ?? 0;
  }));
  return counts;
}

let _sharerCache = null, _sharerAt = 0;
async function distinctSharers() {
  if (_sharerCache && Date.now() - _sharerAt < 300000) return _sharerCache;
  const { data } = await supabase.from('group_posts').select('shared_by').limit(5000);
  _sharerCache = [...new Set((data || []).map(r => r.shared_by).filter(Boolean))];
  _sharerAt = Date.now();
  return _sharerCache;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
    'Cache-Control': 'public, max-age=60'
  }
});

export const config = { path: '/api/group-posts' };
