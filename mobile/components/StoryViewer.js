import React, { useMemo } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function StoryViewer({ visible, stories = [], currentIndex = 0, onClose, onChangeIndex }) {
  const story = useMemo(() => stories[currentIndex] || stories[0] || null, [currentIndex, stories]);

  if (!story) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Image source={{ uri: story.mediaUrl || story.avatar }} style={styles.image} resizeMode="cover" />

          <View style={styles.footer}>
            <View>
              <Text style={styles.name}>{story.name || story.label}</Text>
              <Text style={styles.caption}>{story.caption || story.bio || 'Recent update'}</Text>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.navButton} onPress={() => onChangeIndex?.(Math.max(0, currentIndex - 1))}>
                <Text style={styles.navText}>←</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navButton} onPress={() => onChangeIndex?.(Math.min(stories.length - 1, currentIndex + 1))}>
                <Text style={styles.navText}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  image: {
    width: '100%',
    height: 520,
    backgroundColor: '#e5e7eb',
  },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  caption: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
    maxWidth: 220,
  },
  navRow: {
    flexDirection: 'row',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  navText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
});
