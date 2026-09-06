import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { resolveMediaUrl } from '../config';
import { colors, radius, shadows, spacing, typography } from '../theme';

export default function ProfileHeader({ user, isCurrentUser, onEditProfile, onFollowToggle, onMessage, onOpenFollowers, onOpenFollowing, onAvatarPress }) {
  const followers = user?.followersCount ?? user?.followers?.length ?? 0;
  const following = user?.followingCount ?? user?.following?.length ?? 0;
  const postsCount = user?.postsCount ?? user?.posts?.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onAvatarPress} disabled={!onAvatarPress} style={styles.avatarHitTarget}>
          {user?.profilePicture ? <Image source={{ uri: resolveMediaUrl(user.profilePicture) }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text></View>}
        </TouchableOpacity>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{postsCount}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <TouchableOpacity style={styles.statBox} onPress={onOpenFollowers} disabled={!onOpenFollowers}>
            <Text style={styles.statValue}>{followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statBox} onPress={onOpenFollowing} disabled={!onOpenFollowing}>
            <Text style={styles.statValue}>{following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.username}>@{user?.username}</Text>
      <Text style={styles.bio}>{user?.bio || 'No bio yet.'}</Text>

      <View style={styles.actionRow}>
        {isCurrentUser ? (
          <TouchableOpacity style={styles.primaryButton} onPress={onEditProfile}>
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, user?.isFollowing && styles.secondaryButton]}
              onPress={() => onFollowToggle(user?._id, Boolean(user?.isFollowing))}
            >
              <Text style={[styles.primaryButtonText, user?.isFollowing && styles.secondaryButtonText]}>
                {user?.isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={onMessage}>
              <Text style={styles.secondaryActionText}>Message</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginRight: 18,
  },
  avatarHitTarget: { padding: 4, marginLeft: -4, marginRight: 14 },
  avatarFallback: { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#374151', fontSize: 30, fontWeight: '800' },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  name: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
  },
  username: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: colors.accentSoft,
  },
  secondaryButtonText: {
    color: '#111827',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: colors.input,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryActionText: {
    fontWeight: '700',
    fontSize: 14,
    color: '#111827',
  },
});
