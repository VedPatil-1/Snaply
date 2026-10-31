import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { resolveMediaUrl } from '../config';
import { colors, spacing, typography } from '../theme';

export default function StoryStrip({ stories = [], onOpenStory, onAddStory, currentUser }) {
  const safeStories = Array.isArray(stories) ? stories : [];
  const resolvedAvatar = (item) => resolveMediaUrl(item.avatar || item.profilePicture || currentUser?.profilePicture);

  return (
    <View style={styles.container}>
      <FlatList
        data={safeStories}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id || item._id || String(item.label)}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.storyItem} onPress={() => (item.isCurrentUser && item.isCreateEntry ? onAddStory?.() : onOpenStory?.(index))}>
            <View style={[styles.ring, item.isCurrentUser && !item.isCreateEntry && styles.currentUserRing, item.viewed && styles.viewedRing]}>
              {resolvedAvatar(item) ? (
                <Image source={{ uri: resolvedAvatar(item) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{(item.label || item.name || 'S').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              {item.isCurrentUser ? <TouchableOpacity style={styles.plusBadge} onPress={(event) => { event?.stopPropagation?.(); onAddStory?.(); }}><Text style={styles.plusText}>＋</Text></TouchableOpacity> : null}
            </View>
            <Text style={styles.storyLabel} numberOfLines={1}>
              {item.isCurrentUser ? 'Your story' : (item.label || item.username || 'Story')}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.sm,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 12,
    width: 64,
  },
  ring: {
    width: 58,
    height: 58,
    borderRadius: 32,
    padding: 2,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  currentUserRing: {
    backgroundColor: colors.accentSoft,
  },
  viewedRing: {
    backgroundColor: colors.borderStrong,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  avatarInitial: {
    color: colors.accentDeep,
    fontWeight: '800',
    fontSize: 18,
  },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  plusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
  },
  storyLabel: {
    marginTop: spacing.sm,
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
