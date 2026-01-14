import React from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme/colors';
import uiConstants from '../theme/uiConstants';

interface ScreenProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    scrollable?: boolean;
    hasTabBar?: boolean;
    edges?: Edge[];
    safeArea?: boolean;
    testID?: string;
}

/**
 * A wrapper component for all screens that handles safe area insets and tab bar padding.
 * 
 * @param scrollable - Whether the screen should be scrollable (wraps in ScrollView)
 * @param hasTabBar - Whether the screen is a top-level tab screen (adds bottom padding for tab bar)
 * @param safeArea - Whether to use SafeAreaView (default: true)
 * @param edges - Edges to apply safe area to (default: ['top', 'left', 'right'])
 */
export const Screen: React.FC<ScreenProps> = ({
    children,
    style,
    contentContainerStyle,
    scrollable = false,
    hasTabBar = false,
    safeArea = true,
    edges = ['top', 'left', 'right'],
    testID,
}) => {
    const insets = useSafeAreaInsets();

    // Calculate bottom padding based on tab bar presence
    // If hasTabBar is true, we need enough space for the floating tab bar + its margin + bottom inset
    const bottomPadding = hasTabBar
        ? uiConstants.TAB_BAR_HEIGHT + uiConstants.TAB_BAR_BOTTOM_MARGIN + insets.bottom
        : 0;

    const containerStyle = [
        styles.container,
        style,
    ];

    const contentStyle = [
        hasTabBar && { paddingBottom: bottomPadding },
        contentContainerStyle,
    ];

    const ContentWrapper = scrollable ? ScrollView : View;

    // If not using SafeAreaView, we just return the view with padding
    if (!safeArea) {
        return (
            <View style={containerStyle} testID={testID}>
                <ContentWrapper
                    style={scrollable ? styles.scrollView : styles.content}
                    contentContainerStyle={scrollable ? contentStyle : undefined}
                >
                    {scrollable ? children : <View style={contentStyle}>{children}</View>}
                </ContentWrapper>
            </View>
        );
    }

    return (
        <SafeAreaView style={containerStyle} edges={edges} testID={testID}>
            <ContentWrapper
                style={scrollable ? styles.scrollView : styles.content}
                contentContainerStyle={scrollable ? contentStyle : undefined}
                showsVerticalScrollIndicator={false}
            >
                {scrollable ? children : <View style={[styles.content, contentStyle]}>{children}</View>}
            </ContentWrapper>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.primary,
    },
    content: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
});

export default Screen;
