import { supabase } from '../db/supabase.js';
import { badRequest, check, forbidden, notFound, unauthorized } from '../utils/httpError.js';

const AUTHOR = 'author:profiles!posts_user_id_fkey(id, username, name, avatar_url)';
const POST_FIELDS = `id, caption, vibe, images, created_at, place_id, ${AUTHOR}, place:places(id, name, vibes), likes:post_likes(count), comments:post_comments(count)`;

function shape(post, likedIds = new set()) {
    const {likes, comments, ...rest} = post
    return {
        ...rest,
        likeCount: likes?.[0].count ?? 0,
        commentCount: comments?.[0]?.count ?? 0,
        likedByMe: likedIds.has(post.id)   
    }
}

async function likedSet(userId, postIds) {
  if (!userId || !postIds.length) {
    return new Set();
  }

  const rows = check(await supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds));
  return new Set(rows.map((r) => r.post_id));
}

// handles the friends only feed
async function friendIds(userId) {
  const mine = check(await supabase.from('trip_members').select('trip_id').eq('user_id', userId));
  const tripIds = mine.map((m) => m.trip_id);
  if (!tripIds.length) {
    return [userId];
  }

  const members = check(await supabase.from('trip_members').select('user_id').in('trip_id', tripIds));
  return [...new Set([userId, ...members.map((m) => m.user_id)])];
}

// handles the feed in chronological order
export async function listPosts(req, res) {
    const { vibe, placeId, scope, limit, before} = req.valid.query
    let query = supabase
        .from('posts')
        .select(POST_FIELDS)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (vibe) {
        query = query.eq('vibe', vibe);
    }

    if (placeId) {
        query = query.eq('place_id', placeId)
    }

    if (before) {
        query = query.lt('created_at', before)
    }

    if (scope === 'friends') {
        if (!req.user) {
            throw unauthorized('sign in to see our friends feed')
        }

        query = query.in('user_id', await friendIds(req.user.id))
        
    }

    const posts = check(await query)
    const liked = await likedSet(req.user?.id, posts.map((p) => p.id))
    const items = posts.map((p) => shape(p, liked))

    res.json({ items, nextCursor: items.length == limit ? items.at(-1).created_at : null });
}

export async function getPost(req, res) {
    const post = check(await supabase.from('posts').select(POST_FIELDS).eq('id', req.params.id).single(), 'Post not found');
    res.json(shape(post, await likedSet(req.user?.id, [post.id])));
}

export async function createPost(req, res) {
  const { caption, placeId, vibe, images } = req.valid.body;
  const inserted = check(
    await supabase
      .from('posts')
      .insert({ user_id: req.user.id, caption, place_id: placeId, vibe, images })
      .select('id')
      .single(),
  );
  const post = check(await supabase.from('posts').select(POST_FIELDS).eq('id', inserted.id).single());
  res.status(201).json(shape(post))
}

export async function deletePost(req, res) {
  const post = check(await supabase.from('posts').select('user_id').eq('id', req.params.id).single(), 'Post not found');
  if (post.user_id !== req.user.id) {
    throw forbidden('You can only delete your own posts')
  }

  check(await supabase.from('posts').delete().eq('id', req.params.id));
  res.status(204).end()
}

export async function toggleLike(req, res) {
  const postId = req.params.id;
  const { data: exists } = await supabase.from('posts').select('id').eq('id', postId).maybeSingle();
  if (!exists) {
    throw notFound('Post not found')
  }

  const { data: existing } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (existing) {
    check(await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', req.user.id));
  } else {check(await supabase.from('post_likes').insert({ post_id: postId, user_id: req.user.id }));}

  const { count } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
  res.json({ liked: !existing, likeCount: count ?? 0 });

}

export async function listComments(req, res) {
  const data = check(
    await supabase
      .from('post_comments')
      .select(`id, text, created_at, ${AUTHOR}`)
      .eq('post_id', req.params.id)
      .order('created_at', { ascending: true }),
  );
  res.json(data);
}

export async function addComment(req, res) {
  const { data: exists } = await supabase.from('posts').select('id').eq('id', req.params.id).maybeSingle();
  if (!exists) {
    throw notFound('Post not found')
    }

  const data = check(
    await supabase
      .from('post_comments')
      .insert({ post_id: req.params.id, user_id: req.user.id, text: req.valid.body.text })
      .select(`id, text, created_at, ${AUTHOR}`)
      .single(),
  );

  res.status(201).json(data);
}

export async function deleteComment(req, res) {
  const c = check(
    await supabase.from('post_comments').select('user_id, post_id').eq('id', req.params.commentId).single(),
    'Comment not found',
  );
  if (c.post_id !== req.params.id) {throw badRequest('Comment does not belong to this post')}
  if (c.user_id !== req.user.id) {throw forbidden('You can only delete your own comments')}
  
  check(await supabase.from('post_comments').delete().eq('id', req.params.commentId));
  res.status(204).end();
}