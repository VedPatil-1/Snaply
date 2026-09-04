import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function StoryStrip({ stories = [], onOpenStory }) {
  return (
    <View style={styles.container}>
      <FlatList
        data={stories}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id || item._id || String(item.label)}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.storyItem} onPress={() => onOpenStory?.(index)}>
            <View style={styles.ring}>
              <Image source={{ uri: item.avatar || item.profilePicture }} style={styles.avatar} />
            </View>
            <Text style={styles.storyLabel} numberOfLines={1}>
              {item.label || item.username || 'Story'}
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
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#fff',
  },
  storyLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#374151',
    textAlign: 'center',
  },
});
