import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { resolveMediaUrl } from '../config';

export default function StoryStrip({ stories = [], onOpenStory, onAddStory, currentUser }) {
  const safeStories = Array.isArray(stories) ? stories : [];

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
            <View style={[styles.ring, item.viewed && styles.viewedRing, item.isCurrentUser && !item.isCreateEntry && styles.currentUserRing]}>
              <Image source={{ uri: resolveMediaUrl(item.avatar || item.profilePicture || currentUser?.profilePicture) }} style={styles.avatar} />
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
    marginBottom: 14,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 14,
    width: 70,
  },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    backgroundColor: '#fda4af',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  currentUserRing: {
    backgroundColor: '#111827',
  },
  viewedRing: {
    backgroundColor: '#d1d5db',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#fff',
  },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#111827',
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
    marginTop: 6,
    fontSize: 11,
    color: '#374151',
    textAlign: 'center',
  },
});
