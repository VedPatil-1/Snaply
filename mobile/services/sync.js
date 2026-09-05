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
  postSubscribers.forEach((listener) => listener(post));
}

export function publishUserUpdate(payload) {
  if (!payload?.currentUser?._id && !payload?.targetUser?._id) return;
  userSubscribers.forEach((listener) => listener(payload));
}
