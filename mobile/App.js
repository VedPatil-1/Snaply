import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import ReelsScreen from './screens/ReelsScreen';
import ProfileScreen from './screens/ProfileScreen';
import InboxScreen from './screens/InboxScreen';
import ChatScreen from './screens/ChatScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import ReelViewerScreen from './screens/ReelViewerScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import RelationshipListScreen from './screens/RelationshipListScreen';
import CreateScreen from './screens/CreateScreen';
import ActivityScreen from './screens/ActivityScreen';
import ProfileImageViewerScreen from './screens/ProfileImageViewerScreen';
import { BOTTOM_TAB_BAR_HEIGHT } from './navigationLayout';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function RootTabs() {
  return <Tab.Navigator screenOptions={({ route }) => ({
    headerShown: false,
    tabBarShowLabel: false,
    tabBarStyle: styles.tabBar,
    tabBarActiveTintColor: '#111827',
    tabBarInactiveTintColor: '#64748b',
    tabBarIcon: ({ color, size, focused }) => {
      const icons = {
        Home: focused ? 'home' : 'home-outline',
        Chat: focused ? 'chatbubbles' : 'chatbubbles-outline',
        Reels: focused ? 'play-circle' : 'play-circle-outline',
        Search: focused ? 'search' : 'search-outline',
        Profile: focused ? 'person' : 'person-outline',
      };
      return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
    },
  })}>
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Chat" component={InboxScreen} />
    <Tab.Screen name="Reels" component={ReelsScreen} />
    <Tab.Screen name="Search" component={SearchScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>;
}

// Shared destinations live above tabs so every tab resolves the same route.
export default function App() {
  return <SafeAreaProvider><NavigationContainer><RootStack.Navigator screenOptions={{ headerShown: false }}>
    <RootStack.Screen name="MainTabs" component={RootTabs} />
    <RootStack.Screen name="Create" component={CreateScreen} />
    <RootStack.Screen name="Activity" component={ActivityScreen} />
    <RootStack.Screen name="Inbox" component={InboxScreen} />
    <RootStack.Screen name="ChatThread" component={ChatScreen} />
    <RootStack.Screen name="UserProfile" component={UserProfileScreen} />
    <RootStack.Screen name="PostDetail" component={PostDetailScreen} />
    <RootStack.Screen name="ReelViewer" component={ReelViewerScreen} />
    <RootStack.Screen name="EditProfile" component={EditProfileScreen} />
    <RootStack.Screen name="ProfileViewer" component={ProfileScreen} />
    <RootStack.Screen name="ProfileImageViewer" component={ProfileImageViewerScreen} options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
    <RootStack.Screen name="RelationshipList" component={RelationshipListScreen} />
  </RootStack.Navigator><StatusBar style="dark" /></NavigationContainer></SafeAreaProvider>;
}

const styles = StyleSheet.create({ tabBar: { height: BOTTOM_TAB_BAR_HEIGHT, paddingBottom: 8, paddingTop: 6, borderTopWidth: 0, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 }, elevation: 8 } });
