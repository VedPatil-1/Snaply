import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

import {
  api,
  getAuthToken,
  clearAuthToken,
} from './services/api';

import { BOTTOM_TAB_BAR_HEIGHT } from './navigationLayout';
import { colors } from './theme';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,

        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Chat: focused
              ? 'chatbubbles'
              : 'chatbubbles-outline',
            Reels: focused
              ? 'play-circle'
              : 'play-circle-outline',
            Search: focused
              ? 'search'
              : 'search-outline',
            Profile: focused
              ? 'person'
              : 'person-outline',
          };

          return (
            <Ionicons
              name={icons[route.name] || 'ellipse-outline'}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
      />

      <Tab.Screen
        name="Chat"
        component={InboxScreen}
      />

      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
      />

      <Tab.Screen
        name="Search"
        component={SearchScreen}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator
        size="large"
        color={colors.accent}
      />
    </View>
  );
}

function AuthStack({ onLoggedIn, onRegistered }) {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <RootStack.Screen name="Login">
        {(props) => (
          <LoginScreen
            {...props}
            onLoggedIn={onLoggedIn}
          />
        )}
      </RootStack.Screen>

      <RootStack.Screen name="Register">
        {(props) => (
          <RegisterScreen
            {...props}
            onRegistered={onRegistered}
          />
        )}
      </RootStack.Screen>
    </RootStack.Navigator>
  );
}

function MainStack() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <RootStack.Screen
        name="MainTabs"
        component={RootTabs}
      />

      <RootStack.Screen
        name="Create"
        component={CreateScreen}
      />

      <RootStack.Screen
        name="Activity"
        component={ActivityScreen}
      />

      <RootStack.Screen
        name="Inbox"
        component={InboxScreen}
      />

      <RootStack.Screen
        name="ChatThread"
        component={ChatScreen}
      />

      <RootStack.Screen
        name="UserProfile"
        component={UserProfileScreen}
      />

      <RootStack.Screen
        name="PostDetail"
        component={PostDetailScreen}
      />

      <RootStack.Screen
        name="ReelViewer"
        component={ReelViewerScreen}
      />

      <RootStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
      />

      <RootStack.Screen
        name="ProfileViewer"
        component={ProfileScreen}
      />

      <RootStack.Screen
        name="ProfileImageViewer"
        component={ProfileImageViewerScreen}
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: {
            backgroundColor: 'transparent',
          },
        }}
      />

      <RootStack.Screen
        name="RelationshipList"
        component={RelationshipListScreen}
      />
    </RootStack.Navigator>
  );
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const token = await getAuthToken();

      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        await api.get('/auth/me');

        setIsAuthenticated(true);
      } catch (error) {
        console.log(
          'Stored token is invalid or expired.'
        );

        await clearAuthToken();

        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error(
        'Authentication check failed:',
        error
      );

      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoggedIn = () => {
    setIsAuthenticated(true);
  };

  const handleRegistered = () => {
    setIsAuthenticated(true);
  };

  if (authLoading) {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
        <StatusBar barStyle="dark-content" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {isAuthenticated ? (
          <MainStack />
        ) : (
          <AuthStack
            onLoggedIn={handleLoggedIn}
            onRegistered={handleRegistered}
          />
        )}

        <StatusBar barStyle="dark-content" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabBar: {
    height: BOTTOM_TAB_BAR_HEIGHT,
    paddingBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#25204A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: -5,
    },
    elevation: 10,
  },
});