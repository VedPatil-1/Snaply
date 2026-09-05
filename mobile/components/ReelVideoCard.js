import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { resolveMediaUrl } from '../config';
import { colors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export default function ReelVideoCard({
  reel,
  currentUser,
  isActive,
  isScreenFocused,
  isPlaybackPaused,
  isMuted,
  containerHeight,
  bottomNavigationHeight = 0,
  onLike,
  onFollowToggle,
  onOpenComments,
  onSave,
  onToggleMute,
  onTogglePlayback,
  navigation,
}) {
  const insets = useSafeAreaInsets();
  const videoUrl = resolveMediaUrl(
    reel?.videoUrl || reel?.mediaUrl || ''
  );

  const player = useVideoPlayer(videoUrl || null, (instance) => {
    if (!instance) return;
    instance.loop = true;
    instance.muted = Boolean(isMuted);
  });
  const { status: playerStatus, error: playerError } = useEvent(player, 'statusChange', {
    status: 'idle',
    error: null,
  });

  const [isLiked, setIsLiked] = useState(Boolean(reel?.isLiked));
  const [isSaved, setIsSaved] = useState(Boolean(reel?.isSaved));
  const [likeCount, setLikeCount] = useState(reel?.likesCount || 0);

  const [showHeart, setShowHeart] = useState(false);

  const heartScale = useRef(new Animated.Value(0.4)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const lastTapRef = useRef(0);

  /*
   * Keep local state synchronized with server data.
   */
  useEffect(() => {
    setIsLiked(Boolean(reel?.isLiked));
    setIsSaved(Boolean(reel?.isSaved));
    setLikeCount(Number(reel?.likesCount || 0));
  }, [
    reel?._id,
    reel?.isLiked,
    reel?.isSaved,
    reel?.likesCount,
  ]);

  useEffect(() => {
    if (playerError) {
      console.warn('[Snaply] reel playback error:', reel?._id, playerError?.message || playerError);
    }
  }, [playerError, reel?._id]);

  useEffect(() => {
    if (!player || !videoUrl) return;

    try {
      if (isActive && isScreenFocused && !isPlaybackPaused) {
        player.play();
        console.log('[Snaply] reel autoplay:', reel?._id);
      } else {
        player.pause();
      }
    } catch (playerControlError) {
      console.warn('[Snaply] player control skipped:', playerControlError?.message || playerControlError);
    }
  }, [isActive, isScreenFocused, isPlaybackPaused, player, videoUrl, reel?._id]);

  useEffect(() => () => {
    try {
      player?.pause();
    } catch (error) {
      // The hook may have released the native player before React cleanup.
    }
  }, [player]);

  useEffect(() => {
    if (!player) return;
    try {
      player.muted = Boolean(isMuted);
    } catch (muteError) {
      console.warn('[Snaply] mute update skipped:', muteError?.message || muteError);
    }
  }, [isMuted, player]);

  /*
   * Play only the active reel.
   */
  const creatorName =
    reel?.user?.username ||
    reel?.user?.name ||
    'creator';

  const creatorAvatar = reel?.user?.profilePicture
    ? resolveMediaUrl(reel.user.profilePicture)
    : null;

  const creatorIsCurrentUser =
    currentUser &&
    reel?.user &&
    String(reel.user._id) === String(currentUser._id);

  const followLabel = reel?.user?.isFollowing
    ? 'Following'
    : 'Follow';

  const metadata = useMemo(
    () => ({
      likesCount: likeCount,
      commentsCount:
        reel?.commentsCount ||
        reel?.comments?.length ||
        0,
    }),
    [
      likeCount,
      reel?.commentsCount,
      reel?.comments,
    ]
  );

  /*
   * Double-tap heart.
   */
  const triggerHeart = () => {
    setShowHeart(true);

    heartScale.setValue(0.4);
    heartOpacity.setValue(1);

    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(heartOpacity, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeart(false);
    });
  };

  /*
   * Like / unlike.
   */
  const toggleLike = () => {
    const nextLiked = !isLiked;

    setIsLiked(nextLiked);

    setLikeCount((count) =>
      Math.max(
        0,
        count + (nextLiked ? 1 : -1)
      )
    );

    onLike?.(reel?._id, nextLiked);
  };

  /*
   * Video tap:
   *
   * double tap = like
   * single tap = play/pause
   */
  const handleVideoPress = () => {
    const now = Date.now();

    if (
      lastTapRef.current &&
      now - lastTapRef.current < 280
    ) {
      lastTapRef.current = 0;

      triggerHeart();

      if (!isLiked) {
        setIsLiked(true);

        setLikeCount((count) => count + 1);

        onLike?.(reel?._id, true);
      }

      return;
    }

    lastTapRef.current = now;

    setTimeout(() => {
      if (lastTapRef.current !== now) return;

      if (!isActive) return;
      onTogglePlayback?.();
    }, 290);
  };

  const handleProfilePress = () => {
    if (!reel?.user?._id) return;

    if (creatorIsCurrentUser) {
      navigation?.navigate('ProfileViewer');
    } else {
      navigation?.navigate('UserProfile', {
        userId: reel.user._id,
      });
    }
  };

  const handleShare = async () => {
    const shareUrl =
      reel?.videoUrl ||
      reel?.mediaUrl ||
      '';

    try {
      await Share.share({
        message: shareUrl
          ? `Check out this Snaply reel from @${creatorName}: ${shareUrl}`
          : `Check out this Snaply reel from @${creatorName}`,
      });
    } catch (error) {
      console.warn(
        '[Snaply] share failed:',
        error?.message
      );
    }
  };

  /*
   * Invalid URL.
   */
  if (!videoUrl) {
    return (
      <View
        style={[
          styles.container,
          {
            height: containerHeight,
          },
        ]}
      >
        <View style={styles.centerMessage}>
          <Text style={styles.errorTitle}>
            Unable to load reel
          </Text>

          <Text style={styles.errorText}>
            This reel does not contain a valid video.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          height: containerHeight,
        },
      ]}
    >
      {isActive ? (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFillObject, styles.video]}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
          allowsFullscreen={false}
          surfaceType="surfaceView"
          onLayout={({ nativeEvent }) => {
            console.log('[Snaply] Android VideoView dimensions:', nativeEvent.layout.width, nativeEvent.layout.height);
          }}
        />
      ) : null}

      {/* =====================================================
          VIDEO TOUCH AREA
          ===================================================== */}

      <Pressable
        style={styles.videoHitbox}
        onPress={handleVideoPress}
      />

      {/* =====================================================
          TOP RIGHT MUTE
          ===================================================== */}

      <TouchableOpacity
        style={[styles.muteButton, { top: insets.top + 18 }]}
        onPress={onToggleMute}
        activeOpacity={0.8}
      >
        <Ionicons name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'} size={18} color="#fff" />
      </TouchableOpacity>

      {/* =====================================================
          RIGHT ACTIONS
          ===================================================== */}

      <View
        style={[styles.rightRail, { bottom: bottomNavigationHeight + insets.bottom + 20 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.actionButton}
          onPress={toggleLike}
        >
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={28} color={isLiked ? '#ef4444' : '#fff'} />

          <Text style={styles.actionLabel}>
            {metadata.likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            onOpenComments?.(reel)
          }
        >
          <Ionicons name="chatbubble-outline" size={26} color="#fff" />

          <Text style={styles.actionLabel}>
            {metadata.commentsCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
        >
          <Ionicons name="paper-plane-outline" size={26} color="#fff" />

          <Text style={styles.actionLabel}>
            Share
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            const nextSaved = !isSaved;

            setIsSaved(nextSaved);

            onSave?.(
              reel?._id,
              nextSaved
            );
          }}
        >
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={26} color="#fff" />

          <Text style={styles.actionLabel}>
            {isSaved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* =====================================================
          BOTTOM INFORMATION
          ===================================================== */}

      <View style={[styles.bottomInfo, { bottom: bottomNavigationHeight + insets.bottom + 16 }]}>
        <View style={styles.creatorRow}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={handleProfilePress}
          >
            {creatorAvatar ? (
              <Image
                source={{ uri: creatorAvatar }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarLetter}>
                {creatorName
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleProfilePress}
            style={styles.usernameButton}
          >
            <Text style={styles.username}>
              @{creatorName}
            </Text>
          </TouchableOpacity>

          {!creatorIsCurrentUser && (
            <TouchableOpacity
              style={[
                styles.followButton,
                reel?.user?.isFollowing &&
                styles.followingButton,
              ]}
              onPress={() =>
                onFollowToggle?.(
                  reel?.user?._id,
                  Boolean(
                    reel?.user?.isFollowing
                  )
                )
              }
            >
              <Text
                style={[
                  styles.followText,
                  reel?.user?.isFollowing &&
                  styles.followingText,
                ]}
              >
                {followLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {reel?.caption ? (
          <Text
            style={styles.caption}
          >
            {reel.caption}
          </Text>
        ) : null}

        <Text style={styles.audio}>
          🎵 {reel?.musicName || 'Original Audio'}
        </Text>
      </View>

      {/* =====================================================
          DOUBLE TAP HEART
          ===================================================== */}

      {showHeart && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heartOverlay,
            {
              opacity: heartOpacity,
              transform: [
                {
                  scale: heartScale,
                },
              ],
            },
          ]}
        >
          <Text style={styles.bigHeart}>
            ♥
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'visible',
  },

  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },

  videoHitbox: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },

  muteButton: {
    position: 'absolute',
    top: 18,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    elevation: 50,
  },

  muteIcon: {
    fontSize: 18,
  },

  rightRail: {
    position: 'absolute',
    right: 12,
    bottom: 105,
    alignItems: 'center',
    zIndex: 40,
    elevation: 40,
  },

  actionButton: {
    width: 55,
    alignItems: 'center',
    marginBottom: 17,
  },

  actionIcon: {
    fontSize: 30,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {
      width: 1,
      height: 1,
    },
    textShadowRadius: 5,
  },

  likedIcon: {
    color: '#ff3040',
  },

  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textShadowColor: '#000',
    textShadowOffset: {
      width: 1,
      height: 1,
    },
    textShadowRadius: 4,
  },

  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 85,
    bottom: 25,
    zIndex: 40,
    elevation: 40,
    overflow: 'visible',
  },

  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarLetter: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  usernameButton: {
    marginRight: 8,
  },

  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowOffset: {
      width: 1,
      height: 1,
    },
    textShadowRadius: 5,
  },

  followButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },

  followingButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: '#fff',
  },

  followText: {
    color: '#111',
    fontWeight: '800',
    fontSize: 12,
  },

  followingText: {
    color: '#fff',
  },

  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 7,
    flexShrink: 1,
    textShadowColor: '#000',
    textShadowOffset: {
      width: 1,
      height: 1,
    },
    textShadowRadius: 5,
  },

  audio: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  heartOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    alignItems: 'center',
    zIndex: 100,
    elevation: 100,
  },

  bigHeart: {
    color: '#fff',
    fontSize: 100,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: {
      width: 2,
      height: 2,
    },
    textShadowRadius: 12,
  },

  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  errorTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
  },

  errorText: {
    color: '#aaa',
    textAlign: 'center',
  },
});
