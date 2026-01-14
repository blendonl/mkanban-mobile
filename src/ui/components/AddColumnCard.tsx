import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import theme from '../theme';

interface AddColumnCardProps {
    onPress: () => void;
}

const AddColumnCard: React.FC<AddColumnCardProps> = ({ onPress }) => {
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>+</Text>
                </View>
                <Text style={styles.text}>New Column</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: theme.ui.DEFAULT_COLUMN_WIDTH,
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Slightly transparent/different from regular columns
        borderRadius: theme.radius.card,
        marginHorizontal: theme.spacing.sm,
        padding: theme.spacing.md,
        height: '100%', // Match height of other columns if they stretch, or just be tall enough
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.border.primary,
        borderStyle: 'dashed',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.background.elevated,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
        ...theme.shadows.sm,
    },
    icon: {
        fontSize: 32,
        color: theme.text.secondary,
        fontWeight: '300',
        marginTop: -2, // Visual correction for plus sign vertical alignment
    },
    text: {
        ...theme.typography.textStyles.body,
        color: theme.text.secondary,
        fontWeight: theme.typography.fontWeights.semibold,
    },
});

export default AddColumnCard;
