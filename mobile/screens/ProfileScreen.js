import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileHeader from '../components/ProfileHeader';
import { DEV_USERNAME, resolvePostMediaUrl } from '../config';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReelGridPreview from '../components/ReelGridPreview';
import { apiRequest } from '../services/api';
import { publishPostUpdate, subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography } from '../theme';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedReels, setSavedReels] = useState([]);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [savedView, setSavedView] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const currentUser = await apiRequest('/users/me');
      const [userPosts, userReels] = await Promise.all([
        apiRequest(`/posts/user/${currentUser._id}`),
        apiRequest(`/reels/user/${currentUser._id}`),
      ]);

      setUser({
        ...currentUser,
        postsCount: Number(currentUser.postsCount ?? (userPosts.length + userReels.length)),
        isFollowing: false,
      });
      setPosts(userPosts);
      setReels(userReels);
      setSavedPosts(currentUser.savedPosts || []);
      setSavedReels(currentUser.savedReels || []);
    } catch (error) {
      console.warn('Profile load failed:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  useEffect(() => {
    const unsubscribePost = subscribeToPostUpdates((updatedPost) => {
      setPosts((prev) => prev.map((post) => String(post._id) === String(updatedPost._id) ? { ...post, ...updatedPost } : post));
    });
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(user?._id)) setUser((prev) => ({ ...prev, ...updatedUser, postsCount: prev?.postsCount }));
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [user?._id]);

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleDelete = (item) => {
    const isReel = activeTab === 'reels';
    Alert.alert(isReel ? 'Delete this reel?' : 'Delete this post?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ownerId = item?.user?._id || item?.user?.id || item?.user;
          if (
            !ownerId
            || String(ownerId) !== String(user?._id)
          ) {
            Alert.alert('Permission denied', 'You can only delete your own content.');
            return;
          }

          try {
            setDeleting(true);
            await apiRequest(`/${isReel ? 'reels' : 'posts'}/${item._id}`, {
              method: 'DELETE',
              body: JSON.stringify({ userId: user._id }),
            });
            setSelectedContent(null);
            setUser((prev) => ({ ...prev, postsCount: Math.max(0, Number(prev?.postsCount || 0) - 1) }));
            if (!isReel) publishPostUpdate({ _id: item._id, deleted: true });
            await loadProfile();
          } catch (error) {
            Alert.alert('Delete failed', error.message || 'Unable to delete this item.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const displayedItems = savedView === 'posts' ? savedPosts
    : savedView === 'reels' ? savedReels
      : activeTab === 'reels' ? reels : posts;
  const isReelTab = savedView === 'reels' || (!savedView && activeTab === 'reels');

  const openSavedView = (view) => {
    setAccountMenuVisible(false);
    setSavedView(view);
  };

  const ownsContent = (item) => {
    if (!user?._id) return false;
    const ownerId = item?.user?._id || item?.user?.id || item?.user;
    return Boolean(ownerId) && String(ownerId) === String(user._id);
  };

  const openContentActions = (item) => {
    if (!ownsContent(item) || savedView) return;
    setSelectedContent(item);
  };

  const handleShareProfile = async () => {
    const username = user?.username ? `@${user.username}` : 'Snaply';
    await Share.share({
      message: `View ${username} on Snaply`,
    });
  };

  if (loading) {
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
      <View style={styles.topBar}>
        {navigation.canGoBack() ? <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>Back</Text></TouchableOpacity> : null}
        <Text style={styles.usernameText}>{savedView ? (savedView === 'posts' ? 'Saved Posts' : 'Saved Reels') : `@${user?.username || DEV_USERNAME}`}</Text>
        <View style={styles.iconRow}>
          {savedView ? (
            <TouchableOpacity onPress={() => setSavedView(null)} style={styles.headerIcon} accessibilityLabel="Close saved content">
              <Ionicons name="close" size={21} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setAccountMenuVisible(true)} style={styles.headerIcon} accessibilityLabel="Profile menu">
              <Ionicons name="ellipsis-horizontal" size={21} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={displayedItems}
        keyExtractor={(item) => String(item._id)}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <>
            {savedView ? null : <ProfileHeader
              user={user}
              isCurrentUser
              onEditProfile={handleEditProfile}
              onShareProfile={handleShareProfile}
              onMessage={() => navigation.navigate('Inbox')}
              onOpenFollowers={() => navigation.navigate('RelationshipList', { userId: user?._id, relationship: 'followers' })}
              onOpenFollowing={() => navigation.navigate('RelationshipList', { userId: user?._id, relationship: 'following' })}
            />}
            {!savedView ? <View style={styles.tabBar}>
              {['posts', 'reels'].map((tab) => (
                <TouchableOpacity key={tab} style={[styles.tabButton, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
                  <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab[0].toUpperCase() + tab.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View> : null}
          </>
        )}
        ListEmptyComponent={<View style={styles.placeholderBox}><Text style={styles.placeholderText}>{isReelTab ? 'No reels yet' : 'No posts yet'}</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.profileTile}
            onPress={() => navigation.navigate(isReelTab ? 'ReelViewer' : 'PostDetail', isReelTab ? { reelId: item._id } : { postId: item._id })}
            onLongPress={() => openContentActions(item)}
            delayLongPress={450}
          >
            {isReelTab ? (
              <ReelGridPreview reel={item} style={styles.profileTileImage} />
            ) : resolvePostMediaUrl(item) ? (
              <Image source={{ uri: resolvePostMediaUrl(item) }} style={styles.profileTileImage} resizeMode="cover" />
            ) : (
              <View style={[styles.profileTileImage, styles.mediaFallback]} />
            )}
            {isReelTab ? <View style={styles.videoIndicator}><Text style={styles.profileTileText}>▶</Text></View> : null}
          </TouchableOpacity>
        )}
      />
      <Modal visible={Boolean(selectedContent)} transparent animationType="fade" onRequestClose={() => setSelectedContent(null)}>
        <TouchableOpacity style={styles.actionBackdrop} activeOpacity={1} onPress={() => setSelectedContent(null)}>
          <View style={styles.actionSheet}>
            <TouchableOpacity
              style={styles.deleteAction}
              disabled={deleting}
              onPress={() => {
                const item = selectedContent;
                setSelectedContent(null);
                handleDelete(item);
              }}
            >
              <Text style={styles.deleteActionText}>{deleting ? 'Deleting...' : (isReelTab ? 'Delete Reel' : 'Delete Post')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelAction} onPress={() => setSelectedContent(null)}>
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={accountMenuVisible} transparent animationType="fade" onRequestClose={() => setAccountMenuVisible(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setAccountMenuVisible(false)}>
          <View style={styles.accountMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => openSavedView('posts')}>
              <Ionicons name="bookmark-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Saved Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => openSavedView('reels')}>
              <Ionicons name="play-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Saved Reels</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { marginRight: 10 },
  backText: { color: '#111827', fontWeight: '700' },
  usernameText: {
    ...typography.heading,
    color: colors.text,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconText: {
    fontSize: 20,
    color: colors.accent,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.text,
  },
  placeholderBox: {
    flex: 1,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 16,
  },
  profileTile: {
    width: '50%',
    aspectRatio: 1,
    padding: 1,
    backgroundColor: colors.border,
  },
  profileTileImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  mediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.input,
  },
  videoIndicator: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(17,24,39,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTileText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.18)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 54,
    paddingRight: spacing.md,
  },
  accountMenu: {
    width: 190,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
  },
  menuItem: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  menuItemText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  actionBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 17, 17, 0.18)',
  },
  actionSheet: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteAction: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deleteActionText: {
    ...typography.body,
    color: '#D12B2B',
    fontWeight: '800',
  },
  cancelAction: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
});
