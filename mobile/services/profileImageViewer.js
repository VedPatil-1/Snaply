import { resolveMediaUrl } from '../config';

export function openProfileImageViewer(navigation, user) {
  if (!navigation || !user) return;
  navigation.navigate('ProfileImageViewer', {
    imageUrl: resolveMediaUrl(user.profilePicture),
    fallbackInitial: (user.name || user.username || 'U').charAt(0).toUpperCase(),
    title: user.username ? `@${user.username}` : 'Profile photo',
  });
}
