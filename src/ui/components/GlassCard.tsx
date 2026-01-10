import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import theme from '../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'blue' | 'purple' | 'neutral';
}

export default function GlassCard({
  children,
  style,
  intensity = 20,
  tint = 'neutral',
}: GlassCardProps) {
  return (
    <View style={[styles.container, style]}>
      <BlurView intensity={intensity} tint="dark" style={styles.blur}>
        <View style={[styles.content, { backgroundColor: theme.glass.tint[tint] }]}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  blur: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 12,
  },
});
