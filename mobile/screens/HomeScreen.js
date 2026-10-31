import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PostCard from '../components/PostCard';
import StoryStrip from '../components/StoryStrip';
import StoryViewer from '../components/StoryViewer';
import { apiRequest, toggleFollow } from '../services/api';
import { publishPostUpdate, publishUserUpdate, subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';
import { colors, radius, spacing } from '../theme';

function storiesToViewerGroups(storyRows) {
  return (Array.isArray(storyRows) ? storyRows : [])
    .filter((row) => row?.isCurrentUser || Array.isArray(row?.stories) && row.stories.length)
    .map((row) => {
      const resolvedUserId = row.userId
        || (row.isCurrentUser
          ? String(row.id || '').replace(/^create-/, '')
          : row.id);

      return {
        userId: resolvedUserId,
        name: row.name,
        label: row.label,
        avatar: row.avatar,
        isCurrentUser: Boolean(row.isCurrentUser),
        viewed: Boolean(row.viewed),
        stories: (row.stories || []).map((story) => ({
          ...story,
          name: row.name,
          label: row.label,
          avatar: row.avatar,
          userId: resolvedUserId,
          isCurrentUser: Boolean(row.isCurrentUser),
        })),
      };
    });
}

export default function HomeScreen({ navigation }) {
  const screenFocused = useIsFocused();
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [usersWithStories, setUsersWithStories] = useState([]);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const viewedStoryRequestsRef = React.useRef(new Set());
  const likeQueuesRef = React.useRef(new Map());
  const saveQueuesRef = React.useRef(new Map());
  const likeVersionsRef = React.useRef(new Map());
  const saveVersionsRef = React.useRef(new Map());
  const likeServerStateRef = React.useRef(new Map());
  const followVersionsRef = React.useRef(new Map());

  const openStoryGroup = useCallback((storyGroup, storyIndex) => {
    const groups = storiesToViewerGroups(stories);
    const storyGroupId = String(storyGroup.userId || storyGroup.id || '');
    const nextUserIndex = Math.max(0, groups.findIndex((group) => String(group.userId) === storyGroupId));
    const selectedGroup = groups[nextUserIndex];
    const maxStoryIndex = Math.max(0, (selectedGroup?.stories?.length || 1) - 1);
    const requestedStoryIndex = Number.isFinite(Number(storyIndex)) ? Number(storyIndex) : 0;
    setUsersWithStories(groups);
    setCurrentUserIndex(nextUserIndex);
    setCurrentStoryIndex(Math.min(Math.max(0, requestedStoryIndex), maxStoryIndex));
    setIsStoryViewerOpen(true);
  }, [stories]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const user = await apiRequest('/users/me');
      setCurrentUser(user);

      const [feed, storyResponse] = await Promise.all([
        apiRequest(`/posts/feed?userId=${user._id}`),
        apiRequest(`/stories?userId=${user._id}`),
      ]);

      setPosts(Array.isArray(feed) ? feed : []);
      const nextStories = Array.isArray(storyResponse) ? storyResponse : [];

      if (user && !nextStories.some((story) => String(story?.id || story?._id) === String(user._id) || story?.isCurrentUser)) {
        nextStories.unshift({
          id: String(user._id),
          label: 'your story',
          name: user.name || 'Your story',
          avatar: user.profilePicture,
          mediaUrl: user.profilePicture,
          caption: 'Add to your story',
          viewed: true,
          isCurrentUser: true,
          isCreateEntry: true,
        });
      }

      setStories(nextStories);
      setUsersWithStories(storiesToViewerGroups(nextStories));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load home feed.');
      setPosts([]);
      setStories([]);
      setUsersWithStories([]);
      console.warn('Home feed error:', loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    const unsubscribePost = subscribeToPostUpdates((updatedPost) => {
      if (updatedPost?.deleted) {
        setPosts((prev) => prev.filter((post) => String(post._id) !== String(updatedPost._id)));
        return;
      }
      setPosts((prev) => prev.map((post) => (
        String(post._id) === String(updatedPost._id)
          ? { ...post, ...updatedPost, user: { ...post.user, ...(updatedPost.user || {}), isFollowing: post.user?.isFollowing } }
          : post
      )));
    });
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser, targetUser, isFollowing }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(currentUser?._id)) setCurrentUser(updatedUser);
      if (!targetUser?._id) return;
      setPosts((prev) => prev.map((post) => (
        String(post.user?._id) === String(targetUser._id)
          ? { ...post, user: { ...post.user, isFollowing: typeof isFollowing === 'boolean' ? isFollowing : Boolean(updatedUser?.following?.some((id) => String(id) === String(targetUser._id))) } }
          : post
      )));
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [currentUser?._id]);

  const handleLike = (postId, nextLiked) => {
    if (!currentUser) return;

    const id = String(postId);
    const version = (likeVersionsRef.current.get(id) || 0) + 1;
    likeVersionsRef.current.set(id, version);
    const request = (likeQueuesRef.current.get(id) || Promise.resolve())
      .catch(() => null)
      .then(async () => {
        const currentServerState = likeServerStateRef.current.has(id)
          ? likeServerStateRef.current.get(id)
          : Boolean(posts.find((post) => String(post._id) === id)?.isLiked);
        if (currentServerState === Boolean(nextLiked)) {
          return { isLiked: currentServerState };
        }

        const updatedPost = await apiRequest(`/posts/${postId}/like`, {
          method: 'POST',
          body: JSON.stringify({ userId: currentUser._id }),
        });
        likeServerStateRef.current.set(id, Boolean(updatedPost?.isLiked));

        if (likeVersionsRef.current.get(id) === version) {
          setPosts((prev) => prev.map((post) => (
            String(post._id) === String(postId)
              ? { ...post, ...updatedPost, user: { ...post.user, ...(updatedPost.user || {}), isFollowing: post.user?.isFollowing } }
              : post
          )));
          publishPostUpdate(updatedPost);
        }
        return updatedPost;
      });

    likeQueuesRef.current.set(id, request);
    return request;
  };

  const handleSave = (postId, nextSaved) => {
    if (!currentUser) return;

    const id = String(postId);
    const version = (saveVersionsRef.current.get(id) || 0) + 1;
    saveVersionsRef.current.set(id, version);
    const request = (saveQueuesRef.current.get(id) || Promise.resolve())
      .catch(() => null)
      .then(async () => {
        const updated = await apiRequest(`/users/${currentUser._id}/saved-posts/${postId}`, {
          method: nextSaved ? 'POST' : 'DELETE',
          body: JSON.stringify({ userId: currentUser._id, postId }),
        });
        if (saveVersionsRef.current.get(id) === version) {
          setPosts((prev) => prev.map((post) => String(post._id) === String(postId) ? { ...post, isSaved: Boolean(updated?.isSaved) } : post));
          publishPostUpdate({ ...updated?.post, _id: postId, isSaved: Boolean(updated?.isSaved) });
        }
        return updated;
      });

    saveQueuesRef.current.set(String(postId), request);
    return request;
  };

  const handleFollowToggle = (targetUserId, isFollowing) => {
    if (!currentUser || !targetUserId) return;

    const id = String(targetUserId);
    const nextFollowing = !isFollowing;
    const version = (followVersionsRef.current.get(id) || 0) + 1;
    followVersionsRef.current.set(id, version);
    setPosts((prev) => prev.map((post) => post.user && String(post.user._id) === id
      ? { ...post, user: { ...post.user, isFollowing: nextFollowing } }
      : post));

    const request = toggleFollow(currentUser._id, targetUserId, isFollowing)
      .then((response) => {
        if (followVersionsRef.current.get(id) === version) {
          setPosts((prev) => prev.map((post) => post.user && String(post.user._id) === id
            ? { ...post, user: { ...post.user, isFollowing: Boolean(response?.isFollowing) } }
            : post));
          publishUserUpdate(response);
        }
        return response;
      })
      .catch((error) => {
        if (followVersionsRef.current.get(id) === version) {
          setPosts((prev) => prev.map((post) => post.user && String(post.user._id) === id
            ? { ...post, user: { ...post.user, isFollowing } }
            : post));
        }
        console.warn('Follow toggle failed:', error.message);
        throw error;
      });

    return request;
  };

  const handleAddComment = async (postId, text) => {
    if (!currentUser || !text) return;

    console.log('[Snaply] comment submit started');
    const optimisticComment = {
      _id: `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      user: currentUser,
      text: text.trim(),
    };
    setPosts((prev) => prev.map((post) => String(post._id) === String(postId)
      ? { ...post, comments: [...(post.comments || []), optimisticComment], commentsCount: Number(post.commentsCount || post.comments?.length || 0) + 1 }
      : post));

    try {
      const updatedPost = await apiRequest(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser._id, text }),
      });

      const uniqueComments = [];
      const seenCommentIds = new Set();
      for (const comment of Array.isArray(updatedPost?.comments) ? updatedPost.comments : []) {
        const commentId = String(comment?._id || '');
        if (!commentId || seenCommentIds.has(commentId)) continue;
        seenCommentIds.add(commentId);
        uniqueComments.push(comment);
      }
      const normalizedPost = {
        ...updatedPost,
        comments: uniqueComments,
        commentsCount: uniqueComments.length,
      };

      setPosts((prev) => prev.map((post) => (
        String(post._id) === String(postId)
          ? { ...post, ...normalizedPost, user: { ...post.user, ...(normalizedPost.user || {}), isFollowing: post.user?.isFollowing } }
          : post
      )));
      publishPostUpdate(normalizedPost);
      const newComment = uniqueComments[uniqueComments.length - 1];
      console.log('[Snaply] comment submit success:', newComment?._id);
      console.log('[Snaply] new comment added to top:', newComment?._id);
      console.log('[Snaply] comment count updated');
      return normalizedPost;
    } catch (loadError) {
      setPosts((prev) => prev.map((post) => String(post._id) === String(postId)
        ? { ...post, comments: (post.comments || []).filter((comment) => comment._id !== optimisticComment._id), commentsCount: Math.max(0, Number(post.commentsCount || 0) - 1) }
        : post));
      console.warn('Comment failed:', loadError.message);
      throw loadError;
    }
  };

  const handleShare = async (post) => {
    if (!post) return;

    try {
      const shareUrl = post.mediaUrl || 'https://snaply.app';
      const shareText = `Check out this snap from @${post.user?.username || 'user'}: ${shareUrl}`;
      await Share.share({
        message: `${shareText} ${post.caption ? `\n\n${post.caption}` : ''}`,
        url: shareUrl,
      });
    } catch (loadError) {
      console.warn('Share failed:', loadError.message);
    }
  };

  const handleProfileClick = (userId) => {
    if (!userId || !currentUser) return;
    if (String(userId) === String(currentUser._id)) {
      navigation.navigate('ProfileViewer');
      return;
    }
    navigation.navigate('UserProfile', { userId });
  };

  const handleStoryViewed = useCallback(async (story) => {
    if (!currentUser || !story?.id) return;
    const storyId = String(story.id);
    const storyUserId = String(story.userId || '');
    if (!storyUserId) return;
    if (viewedStoryRequestsRef.current.has(storyId)) return;
    viewedStoryRequestsRef.current.add(storyId);

    const updateViewedStory = (viewed) => {
      setStories((previous) => previous.map((item) => {
        if (String(item.userId || item.id) !== storyUserId) return item;
        const nextStoryList = (item.stories || []).map((entry) => String(entry.id) === storyId ? { ...entry, viewed } : entry);
        return { ...item, stories: nextStoryList, viewed: nextStoryList.length > 0 && nextStoryList.every((entry) => entry.viewed) };
      }));
      setUsersWithStories((previous) => previous.map((group) => {
        if (String(group.userId) !== storyUserId) return group;
        const nextStoryList = group.stories.map((entry) => String(entry.id) === storyId ? { ...entry, viewed } : entry);
        return { ...group, viewed: nextStoryList.length > 0 && nextStoryList.every((entry) => entry.viewed), stories: nextStoryList };
      }));
    };

    try {
      await apiRequest(`/stories/${story.id}/view`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser._id }),
      });
      updateViewedStory(true);
    } catch (error) {
      viewedStoryRequestsRef.current.delete(storyId);
      console.warn('Story view update failed:', error.message);
    }
  }, [currentUser]);

  const handleStoryDelete = useCallback((story) => {
    if (!currentUser || !story?.id || !story.isCurrentUser) return;
    Alert.alert('Delete story?', 'This Story will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/stories/${story.id}`, {
              method: 'DELETE',
              body: JSON.stringify({ userId: currentUser._id }),
            });
            setUsersWithStories((previous) => previous.map((group) => String(group.userId) === String(story.userId)
              ? { ...group, stories: group.stories.filter((entry) => String(entry.id) !== String(story.id)) }
              : group).filter((group) => group.stories.length || group.isCurrentUser));
            setStories((previous) => previous.map((entry) => {
              if (!entry.isCurrentUser) return entry;
              const remaining = (entry.stories || []).filter((item) => String(item.id) !== String(story.id));
              return remaining.length
                ? { ...entry, id: remaining[0].id, stories: remaining, mediaUrl: remaining[0].mediaUrl, mediaType: remaining[0].mediaType, caption: remaining[0].caption, viewed: true, isCreateEntry: false }
                : { ...entry, id: `create-${currentUser._id}`, stories: [], mediaUrl: currentUser.profilePicture, mediaType: null, caption: 'Add to your story', viewed: true, isCreateEntry: true };
            }));
              setCurrentStoryIndex(0);
              setIsStoryViewerOpen(false);
          } catch (deleteError) {
            Alert.alert('Delete failed', deleteError.message || 'Unable to delete story.');
          }
        },
      },
    ]);
  }, [currentUser]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, [loadFeed]);

  const renderFeedError = () => (
    <View style={styles.centerState}>
      <Text style={styles.errorTitle}>Unable to load home feed</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadFeed}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>CURATED FOR YOU</Text>
          <Text style={styles.logo}>Snaply</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Create', { mode: 'post' })} accessibilityRole="button" accessibilityLabel="Create post">
            <Ionicons name="add" size={20} color="#6657E8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Inbox')} accessibilityRole="button" accessibilityLabel="Messages">
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#6657E8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Activity')} accessibilityRole="button" accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={19} color="#6657E8" />
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        renderFeedError()
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />}
          showsVerticalScrollIndicator={false}
        >
          <StoryStrip
            stories={stories}
            currentUser={currentUser}
            onAddStory={() => navigation.navigate('Create', { mode: 'story' })}
            onOpenStory={(index) => {
              const nextStory = stories[index];
              if (!nextStory) return;
              openStoryGroup(nextStory, index);
            }}
          />

          {posts.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyText}>Follow people or create your first snap.</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Create', { mode: 'post' })}>
                <Text style={styles.emptyButtonText}>Create a post</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                currentUser={currentUser}
                onLike={handleLike}
                onFollowToggle={handleFollowToggle}
                onAddComment={handleAddComment}
                onShare={handleShare}
                onSave={handleSave}
                onProfileClick={handleProfileClick}
              />
            ))
          )}
        </ScrollView>
      )}

      <StoryViewer
        visible={isStoryViewerOpen}
        screenFocused={screenFocused}
        usersWithStories={usersWithStories}
        currentUserIndex={currentUserIndex}
        currentStoryIndex={currentStoryIndex}
        onClose={() => setIsStoryViewerOpen(false)}
        onChangePosition={(nextUserIndex, nextStoryIndex) => { setCurrentUserIndex(nextUserIndex); setCurrentStoryIndex(nextStoryIndex); }}
        onViewed={handleStoryViewed}
        onDeleteStory={handleStoryDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF5',
  },
  logo: {
    fontFamily: undefined,
    fontSize: 26,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.6,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  errorText: {
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
