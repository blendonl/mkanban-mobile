import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme/colors';
import {
  ProjectsIcon,
  BoardsIcon,
  AgendaIcon,
  NotesIcon,
  TimeIcon,
} from '../components/icons/TabIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_WIDTH = SCREEN_WIDTH - 32;
const TAB_BAR_HEIGHT = 64;

const AnimatedView = Animated.createAnimatedComponent(View);

interface TabItemProps {
  route: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ route, focused, onPress, onLongPress }: TabItemProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.15 : 1) }],
    opacity: withTiming(focused ? 1 : 0.6),
  }));

  const iconMap: Record<string, React.FC<{ focused: boolean }>> = {
    ProjectsTab: ProjectsIcon,
    BoardsTab: BoardsIcon,
    AgendaTab: AgendaIcon,
    NotesTab: NotesIcon,
    TimeTab: TimeIcon,
  };

  const Icon = iconMap[route];
  if (!Icon) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <AnimatedView style={[styles.iconContainer, animatedStyle]}>
        <Icon focused={focused} />
        {focused && <View style={styles.activeIndicator} />}
      </AnimatedView>
    </TouchableOpacity>
  );
}

export default function FloatingTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.tabBarWrapper}>
        <BlurView intensity={25} tint="dark" style={styles.blur}>
          <View style={styles.tabBarContent}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TabItem
                  key={route.key}
                  route={route.name}
                  focused={focused}
                  onPress={onPress}
                  onLongPress={() =>
                    navigation.emit({ type: 'tabLongPress', target: route.key })
                  }
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tabBarWrapper: {
    width: TAB_BAR_WIDTH,
    height: TAB_BAR_HEIGHT,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glass.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  blur: {
    flex: 1,
  },
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.glass.tint.neutral,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.accent.primary,
  },
});
