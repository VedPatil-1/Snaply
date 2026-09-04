const postSubscribers = new Set();
const userSubscribers = new Set();

export function subscribeToPostUpdates(listener) {
  postSubscribers.add(listener);
  return () => postSubscribers.delete(listener);
}

export function subscribeToUserUpdates(listener) {
  userSubscribers.add(listener);
  return () => userSubscribers.delete(listener);
}

export function publishPostUpdate(post) {
  if (!post?._id) return;
  console.log('[Snaply] shared post update:', post._id);
  postSubscribers.forEach((listener) => listener(post));
}

export function publishUserUpdate(payload) {
  if (!payload?.currentUser?._id && !payload?.targetUser?._id) return;
  console.log('[Snaply] follow state synced:', payload.targetUser?._id || payload.currentUser?._id);
  userSubscribers.forEach((listener) => listener(payload));
}
