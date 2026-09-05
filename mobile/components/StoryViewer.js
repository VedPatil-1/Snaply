import React, { useMemo } from 'react';
import { Image, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { resolveMediaUrl } from '../config';

export default function StoryViewer({ visible, screenFocused = true, usersWithStories = [], currentUserIndex = 0, currentStoryIndex = 0, onChangePosition, onDeleteStory, onViewed, onClose }) {
  const userGroup = usersWithStories[currentUserIndex] || null;
  const stories = userGroup?.stories || [];
  const story = useMemo(() => stories[currentStoryIndex] || null, [currentStoryIndex, stories]);
  const storyVideoUrl = story?.mediaType === 'video' ? resolveMediaUrl(story.mediaUrl) : null;
  const player = useVideoPlayer(storyVideoUrl, (instance) => {
    if (!instance) return;
    instance.muted = false;
    instance.loop = false;
    instance.timeUpdateEventInterval = 0.25;
  });
  const { status } = useEvent(player, 'statusChange', { status: player?.status });
  const { duration } = useEvent(player, 'sourceLoad', { duration: player?.duration || 0 });
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: player?.currentTime || 0 });

  const stopPlayback = React.useCallback(() => {
    if (!player) return;
    try {
      player.pause();
      player.currentTime = 0;
    } catch (error) {
      // The managed player may already be releasing during unmount.
    }
  }, [player]);

  React.useEffect(() => {
    if (!visible || !screenFocused || !storyVideoUrl) {
      stopPlayback();
      return undefined;
    }

    return stopPlayback;
  }, [visible, screenFocused, storyVideoUrl, stopPlayback]);

  React.useEffect(() => {
    if (visible && story) onViewed?.(story);
  }, [visible, story, onViewed]);

  const closeViewer = React.useCallback(() => {
    stopPlayback();
    onClose?.();
  }, [stopPlayback, onClose]);

  const goToNextStory = React.useCallback(() => {
    stopPlayback();
    if (currentStoryIndex < stories.length - 1) {
      onChangePosition?.(currentUserIndex, currentStoryIndex + 1);
    } else if (currentUserIndex < usersWithStories.length - 1) {
      onChangePosition?.(currentUserIndex + 1, 0);
    } else {
      closeViewer();
    }
  }, [stopPlayback, currentStoryIndex, stories.length, currentUserIndex, usersWithStories.length, onChangePosition, closeViewer]);

  const goToPreviousStory = React.useCallback(() => {
    stopPlayback();
    if (currentStoryIndex > 0) {
      onChangePosition?.(currentUserIndex, currentStoryIndex - 1);
    } else if (currentUserIndex > 0) {
      const previousStories = usersWithStories[currentUserIndex - 1]?.stories || [];
      onChangePosition?.(currentUserIndex - 1, Math.max(0, previousStories.length - 1));
    }
  }, [stopPlayback, currentStoryIndex, currentUserIndex, usersWithStories, onChangePosition]);

  React.useEffect(() => {
    if (!visible || !story || storyVideoUrl) return undefined;
    const timer = setTimeout(goToNextStory, 5000);
    return () => clearTimeout(timer);
  }, [visible, story, storyVideoUrl, goToNextStory]);

  React.useEffect(() => {
    if (!visible || !storyVideoUrl || !player) return undefined;
    const subscription = player.addListener('playToEnd', goToNextStory);
    return () => subscription.remove();
  }, [visible, storyVideoUrl, player, goToNextStory]);

  React.useEffect(() => {
    if (!visible || !screenFocused || !storyVideoUrl || !player || status === 'error') return;
    if (player.status === 'readyToPlay' && !player.playing) player.play();
  }, [visible, screenFocused, storyVideoUrl, player, status]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dx) > 24 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderRelease: (_event, gestureState) => {
      if (gestureState.dx < -60) goToNextStory();
      if (gestureState.dx > 60) goToPreviousStory();
    },
  }), [goToNextStory, goToPreviousStory]);

  if (!story) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={closeViewer}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeButton} onPress={closeViewer}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          {story.isCurrentUser ? (
            <TouchableOpacity style={styles.deleteButton} onPress={() => onDeleteStory?.(story)}>
              <Text style={styles.deleteText}>⋯</Text>
            </TouchableOpacity>
          ) : null}

          <View {...panResponder.panHandlers} style={styles.mediaArea}>
          {storyVideoUrl ? (
            <VideoView player={player} style={styles.image} contentFit="contain" nativeControls />
          ) : (
            <Image source={{ uri: resolveMediaUrl(story.mediaUrl || story.avatar) }} style={styles.image} resizeMode="contain" />
          )}
          {currentUserIndex > 0 || currentStoryIndex > 0 ? <TouchableOpacity style={[styles.userArrow, styles.leftArrow]} onPress={goToPreviousStory}><Text style={styles.arrowText}>‹</Text></TouchableOpacity> : null}
          {currentStoryIndex < stories.length - 1 || currentUserIndex < usersWithStories.length - 1 ? <TouchableOpacity style={[styles.userArrow, styles.rightArrow]} onPress={goToNextStory}><Text style={styles.arrowText}>›</Text></TouchableOpacity> : null}
          </View>

          <View style={styles.footer}>
            <View>
              <Text style={styles.name}>{story.name || story.label}</Text>
              <Text style={styles.caption}>{story.caption || story.bio || 'Recent update'}</Text>
            </View>
          </View>
          <View style={styles.progressRow}>
            {stories.map((entry, index) => {
              const progress = index < currentStoryIndex
                ? 1
                : index > currentStoryIndex
                  ? 0
                  : storyVideoUrl && duration > 0
                    ? Math.min(1, currentTime / Math.min(duration, 30))
                    : 0;
              return (
                <View key={entry.id} style={styles.progressTrack}>
                  <View style={[styles.progressActive, { width: `${progress * 100}%` }]} />
                </View>
              );
            })}
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
  deleteButton: {
    position: 'absolute',
    top: 16,
    right: 56,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: '#111827', fontSize: 22, fontWeight: '700', lineHeight: 22 },
  image: {
    width: '100%',
    height: 520,
    backgroundColor: '#e5e7eb',
  },
  mediaArea: {
    position: 'relative',
    backgroundColor: '#e5e7eb',
  },
  userArrow: {
    position: 'absolute',
    top: '45%',
    width: 44,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftArrow: { left: 10 },
  rightArrow: { right: 10 },
  arrowText: { color: '#fff', fontSize: 38, lineHeight: 42, fontWeight: '300' },
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
  progressRow: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  progressActive: { backgroundColor: '#fff' },
});
