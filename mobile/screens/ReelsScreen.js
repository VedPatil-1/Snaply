import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import ReelCommentsModal from '../components/ReelCommentsModal';
import ReelVideoCard from '../components/ReelVideoCard';
import { apiRequest } from '../services/api';
import { publishUserUpdate, subscribeToUserUpdates } from '../services/sync';
import { BOTTOM_TAB_BAR_HEIGHT } from '../navigationLayout';

export default function ReelsScreen({
  navigation,
  initialReelId,
}) {
  const { height: windowHeight } =
    useWindowDimensions();

  const [reels, setReels] = useState([]);
  const [currentUser, setCurrentUser] =
    useState(null);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [isMuted, setIsMuted] =
    useState(true);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [commentsVisible, setCommentsVisible] =
    useState(false);

  const [selectedReel, setSelectedReel] =
    useState(null);

  const flatListRef = useRef(null);
  const isFocused = useIsFocused();
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);

  /*
   * Load reels.
   */
  const loadReels = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [user, response] =
        await Promise.all([
          apiRequest('/users/me'),
          apiRequest('/reels'),
        ]);

      const serverReels = Array.isArray(response)
        ? response
        : [];

      const validReels =
        serverReels.filter(
          (reel) =>
            reel?.videoUrl ||
            reel?.mediaUrl
        );

      console.log(
        '[Snaply] reels loaded:',
        validReels.length
      );

      setCurrentUser(user);
      setReels(validReels);

      let startingIndex = 0;

      if (initialReelId) {
        const foundIndex =
          validReels.findIndex(
            (reel) =>
              String(reel._id) ===
              String(initialReelId)
          );

        if (foundIndex >= 0) {
          startingIndex = foundIndex;
        }
      }

      setActiveIndex(startingIndex);

      /*
       * Scroll after FlatList receives the data.
       */
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: startingIndex,
          animated: false,
        });
      }, 100);
    } catch (loadError) {
      console.warn(
        '[Snaply] reel loading failed:',
        loadError?.message
      );

      setError(
        loadError?.message ||
        'Unable to load reels.'
      );

      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [initialReelId]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Snaply] refreshing reels after publish');
      setIsPlaybackPaused(false);
      loadReels();
      return () => setIsPlaybackPaused(true);
    }, [loadReels])
  );

  useEffect(() => subscribeToUserUpdates(({ currentUser: updatedCurrentUser, targetUser }) => {
    if (updatedCurrentUser?._id && String(updatedCurrentUser._id) === String(currentUser?._id)) setCurrentUser(updatedCurrentUser);
    if (!targetUser?._id) return;
    setReels((previous) => previous.map((reel) => String(reel?.user?._id) === String(targetUser._id)
      ? { ...reel, user: { ...reel.user, isFollowing: Boolean(updatedCurrentUser?.following?.some((id) => String(id) === String(targetUser._id))) } }
      : reel));
  }), [currentUser?._id]);

  /*
   * Active reel changes while scrolling.
   */
  const handleScrollEnd = useCallback(
    (event) => {
      if (!reels.length) return;

      const height =
        Math.max(
          1,
          windowHeight
        );

      const offset =
        event.nativeEvent.contentOffset.y;

      let index = Math.round(
        offset / height
      );

      /*
       * Endless loop.
       *
       * Last reel -> first reel
       */
      if (index >= reels.length - 1) {
        index = 0;

        requestAnimationFrame(() => {
          flatListRef.current?.scrollToIndex({
            index: 0,
            animated: false,
          });
        });
      }

      if (index < 0) {
        index = 0;
      }

      setActiveIndex(index);
    },
    [reels.length, windowHeight]
  );

  /*
   * Also update active item through viewability.
   */
  const onViewableItemsChanged = useRef(
    ({ viewableItems }) => {
      const first =
        viewableItems?.find(
          (item) => item.isViewable
        );

      if (
        first &&
        typeof first.index === 'number'
      ) {
        setActiveIndex(first.index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
  }).current;

  /*
   * Update reel locally.
   */
  const updateReel = useCallback(
    (reelId, updater) => {
      setReels((previous) =>
        previous.map((reel) =>
          String(reel._id) ===
            String(reelId)
            ? updater(reel)
            : reel
        )
      );
    },
    []
  );

  /*
   * LIKE
   */
  const handleLike = useCallback(
    async (reelId, nextLiked) => {
      if (!currentUser) return;

      const previous =
        reels.find(
          (reel) =>
            String(reel._id) ===
            String(reelId)
        );

      if (!previous) return;

      updateReel(
        reelId,
        (reel) => ({
          ...reel,
          isLiked: nextLiked,
          likesCount: Math.max(
            0,
            Number(reel.likesCount || 0) +
            (nextLiked ? 1 : -1)
          ),
        })
      );

      try {
        const updated = await apiRequest(
            `/reels/${reelId}/like`,
            {
              method: nextLiked
                ? 'POST'
                : 'DELETE',

              body: JSON.stringify({
                userId:
                  currentUser._id,
              }),
            }
          );

        if (updated) {
          updateReel(
            reelId,
            () => updated
          );
        }
      } catch (requestError) {
        updateReel(
          reelId,
          () => previous
        );

        console.warn(
          '[Snaply] reel like failed:',
          requestError?.message
        );
      }
    },
    [
      currentUser,
      reels,
      updateReel,
    ]
  );

  /*
   * SAVE
   */
  const handleSave = useCallback(
    async (reelId, nextSaved) => {
      if (!currentUser) return;

      const previous =
        reels.find(
          (reel) =>
            String(reel._id) ===
            String(reelId)
        );

      if (!previous) return;

      updateReel(
        reelId,
        (reel) => ({
          ...reel,
          isSaved: nextSaved,
        })
      );

      try {
        const response =
          await apiRequest(
            `/users/${currentUser._id}/saved-reels/${reelId}`,
            {
              method: nextSaved
                ? 'POST'
                : 'DELETE',

              body: JSON.stringify({
                userId:
                  currentUser._id,

                reelId,
              }),
            }
          );

        updateReel(
          reelId,
          (reel) => ({
            ...reel,
            isSaved:
              Boolean(
                response?.isSaved
              ),
          })
        );

        if (response?.user) {
          setCurrentUser(
            response.user
          );
        }
      } catch (requestError) {
        updateReel(
          reelId,
          () => previous
        );

        console.warn(
          '[Snaply] reel save failed:',
          requestError?.message
        );
      }
    },
    [
      currentUser,
      reels,
      updateReel,
    ]
  );

  /*
   * FOLLOW / UNFOLLOW
   */
  const handleFollowToggle =
    useCallback(
      async (
        targetUserId,
        isFollowing
      ) => {
        if (
          !currentUser ||
          !targetUserId
        ) {
          return;
        }

        try {
          const response = await apiRequest(
            `/users/${targetUserId}/follow`,
            {
              method: isFollowing
                ? 'DELETE'
                : 'POST',

              body: JSON.stringify({
                currentUserId:
                  currentUser._id,
              }),
            }
          );

          setReels((previous) =>
            previous.map((reel) => {
              if (
                String(
                  reel?.user?._id
                ) !==
                String(targetUserId)
              ) {
                return reel;
              }

              return {
                ...reel,
                user: {
                  ...reel.user,
                  isFollowing:
                    !isFollowing,
                },
              };
            })
          );
          publishUserUpdate(response);
        } catch (requestError) {
          console.warn(
            '[Snaply] follow failed:',
            requestError?.message
          );
        }
      },
      [currentUser]
    );

  /*
   * COMMENTS
   */
  const handleOpenComments =
    useCallback((reel) => {
      setSelectedReel(reel);
      setCommentsVisible(true);
    }, []);

  const handleSubmitComment =
    useCallback(
      async (reelId, text) => {
        if (
          !currentUser ||
          !text?.trim()
        ) {
          return;
        }

        try {
          const updated =
            await apiRequest(
              `/reels/${reelId}/comments`,
              {
                method: 'POST',

                body: JSON.stringify({
                  userId:
                    currentUser._id,

                  text: text.trim(),
                }),
              }
            );

          if (updated) {
            updateReel(
              reelId,
              () => updated
            );

            setSelectedReel(
              updated
            );
          }
        } catch (requestError) {
          console.warn(
            '[Snaply] comment failed:',
            requestError?.message
          );
        }
      },
      [
        currentUser,
        updateReel,
      ]
    );

  /*
   * LOADING
   */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#fff"
        />
      </View>
    );
  }

  /*
   * ERROR
   */
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>
          Unable to load reels
        </Text>

        <Text style={styles.message}>
          {error}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadReels}
        >
          <Text style={styles.retryText}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
   * EMPTY
   */
  if (!reels.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>
          No reels yet
        </Text>

        <Text style={styles.message}>
          There are no playable reels to show.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.feedContainer}>
        <FlatList
          ref={flatListRef}
          data={reels}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item, index }) => (
            <ReelVideoCard
              reel={item}
              currentUser={currentUser}
              isActive={index === activeIndex}
              isScreenFocused={isFocused}
              isPlaybackPaused={isPlaybackPaused}
              isMuted={isMuted}
              containerHeight={windowHeight}
              bottomNavigationHeight={BOTTOM_TAB_BAR_HEIGHT}
              onLike={handleLike}
              onFollowToggle={handleFollowToggle}
              onOpenComments={handleOpenComments}
              onSave={handleSave}
              onToggleMute={() => setIsMuted((value) => !value)}
              onTogglePlayback={() => setIsPlaybackPaused((value) => !value)}
              navigation={navigation}
            />
          )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToAlignment="start"
        onMomentumScrollEnd={
          handleScrollEnd
        }
        onViewableItemsChanged={
          onViewableItemsChanged
        }
        viewabilityConfig={
          viewabilityConfig
        }
        getItemLayout={(_, index) => ({
          length: windowHeight,
          offset:
            windowHeight * index,
          index,
        })}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews={false}
        extraData={[
          activeIndex,
          isMuted,
          isFocused,
          isPlaybackPaused,
        ]}
        />

        <ReelCommentsModal
          visible={commentsVisible}
          reel={selectedReel}
          currentUser={currentUser}
          onClose={() => setCommentsVisible(false)}
          onSubmitComment={handleSubmitComment}
          onOpenProfile={(userId) => String(userId) === String(currentUser?._id) ? navigation.navigate('ProfileViewer') : navigation.navigate('UserProfile', { userId })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },

  feedContainer: {
    flex: 1,
    backgroundColor: '#000',
  },

  centered: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },

  message: {
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 18,
  },

  retryButton: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },

  retryText: {
    color: '#111',
    fontWeight: '700',
  },
});
