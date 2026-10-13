import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import * as c from '../controllers/postsController.js';
import { postsQuery, createPostBody, commentBody, idParam, commentParam } from './schemas.js';

const r = Router();
r.get('/', optionalAuth, validate({ query: postsQuery }), c.listPosts);

r.get('/:id', optionalAuth, validate({ params: idParam }), c.getPost);

r.post('/', requireAuth,validate({ body: createPostBody }), c.createPost);

r.delete('/:id', requireAuth, validate({ params: idParam }), c.deletePost);

r.post('/:id/like', requireAuth, validate({ params: idParam }), c.toggleLike);

r.get('/:id/comments', validate({ params: idParam }), c.listComments);

r.post('/:id/comments', requireAuth, validate({ params: idParam, body: commentBody }), c.addComment);

r.delete('/:id/comments/:commentId', requireAuth, validate({ params: commentParam }), c.deleteComment);

export default r;