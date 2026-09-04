import React, { useCallback, useEffect, useState } from 'react';
import {
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
import PostCard from '../components/PostCard';
import StoryStrip from '../components/StoryStrip';
import StoryViewer from '../components/StoryViewer';
import { apiRequest } from '../services/api';
import { publishPostUpdate, publishUserUpdate, subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';

export default function HomeScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const user = await apiRequest('/users/me');
      setCurrentUser(user);

      const [feed, storyResponse] = await Promise.all([
        apiRequest(`/posts/feed?userId=${user._id}`),
        apiRequest('/stories'),
      ]);

      setPosts(Array.isArray(feed) ? feed : []);
      setStories(Array.isArray(storyResponse) ? storyResponse : []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load home feed.');
      setPosts([]);
      setStories([]);
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
      setPosts((prev) => prev.map((post) => (
        String(post._id) === String(updatedPost._id)
          ? { ...post, ...updatedPost, user: { ...post.user, ...(updatedPost.user || {}), isFollowing: post.user?.isFollowing } }
          : post
      )));
    });
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser, targetUser }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(currentUser?._id)) setCurrentUser(updatedUser);
      if (!targetUser?._id) return;
      setPosts((prev) => prev.map((post) => (
        String(post.user?._id) === String(targetUser._id)
          ? { ...post, user: { ...post.user, isFollowing: Boolean(updatedUser?.following?.some((id) => String(id) === String(targetUser._id))) } }
          : post
      )));
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [currentUser?._id]);

  const handleLike = async (postId) => {
    if (!currentUser) return;

    try {
      const updatedPost = await apiRequest(`/posts/${postId}/like`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser._id }),
      });

      setPosts((prev) => prev.map((post) => (
        String(post._id) === String(postId)
          ? { ...post, ...updatedPost, user: { ...post.user, ...(updatedPost.user || {}), isFollowing: post.user?.isFollowing } }
          : post
      )));
      publishPostUpdate(updatedPost);
    } catch (loadError) {
      console.warn('Like toggle failed:', loadError.message);
    }
  };

  const handleFollowToggle = async (targetUserId, isFollowing) => {
    if (!currentUser || !targetUserId) return;

    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await apiRequest(`/users/${targetUserId}/follow`, {
        method,
        body: JSON.stringify({ currentUserId: currentUser._id }),
      });

      setPosts((prev) =>
        prev.map((post) =>
          post.user && String(post.user._id) === String(targetUserId)
            ? {
                ...post,
                user: {
                  ...post.user,
                  isFollowing: !isFollowing,
                },
              }
            : post
        )
      );

      if (response?.targetUser) {
        publishUserUpdate(response);
      }
    } catch (loadError) {
      console.warn('Follow toggle failed:', loadError.message);
    }
  };

  const handleAddComment = async (postId, text) => {
    if (!currentUser || !text) return;

    console.log('[Snaply] comment submit started');
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
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Text style={styles.logo}>Snaply</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Create')}>
            <Text style={styles.iconText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Inbox')}>
            <Text style={styles.iconText}>✉</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Activity')}>
            <Text style={styles.iconText}>🔔</Text>
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
          <StoryStrip stories={stories} onOpenStory={(index) => {
            setStoryIndex(index);
            setIsStoryViewerOpen(true);
          }} />

          {posts.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyText}>Your feed is empty.</Text>
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
                onProfileClick={handleProfileClick}
              />
            ))
          )}
        </ScrollView>
      )}

      <StoryViewer
        visible={isStoryViewerOpen}
        stories={stories}
        currentIndex={storyIndex}
        onClose={() => setIsStoryViewerOpen(false)}
        onChangeIndex={setStoryIndex}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  iconText: {
    fontSize: 18,
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
