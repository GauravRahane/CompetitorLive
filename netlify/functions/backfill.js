import { supabase, COMPETITORS, scrapeLinkedIn } from './shared.mjs';

export const handler = async (event) => {
  if (event.headers['x-poll-secret'] !== process.env.POLL_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let updated = 0;

  for (const competitor of COMPETITORS) {
    const posts = await scrapeLinkedIn(competitor);

    for (const post of posts) {
      if (!post.image_url) continue;

      const { error } = await supabase
        .from('posts')
        .update({ image_url: post.image_url })
        .eq('id', post.id);

      if (!error) updated++;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Updated ${updated} posts with images` })
  };
};
