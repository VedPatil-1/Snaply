import React from 'react';
import ReelsScreen from './ReelsScreen';

export default function ReelViewerScreen({ route, navigation }) {
  return <ReelsScreen navigation={navigation} initialReelId={route?.params?.reelId} />;
}
