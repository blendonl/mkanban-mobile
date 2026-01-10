import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import BaseModal from './BaseModal';
import { Input, TextArea } from './Input';
import { Button, SecondaryButton } from './Button';
import theme from '../theme/colors';
import { spacing } from '../theme/spacing';
import { CheckIcon } from './icons/TabIcons';

const PROJECT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

interface ProjectCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, color: string) => Promise<void>;
}

export default function ProjectCreateModal({
  visible,
  onClose,
  onSubmit,
}: ProjectCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit(name.trim(), description.trim(), color);
      handleClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setColor(PROJECT_COLORS[0]);
    setError('');
    onClose();
  };

  const footer = (
    <View style={styles.footer}>
      <SecondaryButton
        title="Cancel"
        onPress={handleClose}
        style={styles.cancelButton}
      />
      <Button
        title="Create Project"
        onPress={handleSubmit}
        loading={loading}
        disabled={!name.trim()}
      />
    </View>
  );

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      title="New Project"
      footer={footer}
    >
      <Input
        label="Project Name"
        placeholder="Enter project name"
        value={name}
        onChangeText={setName}
        autoFocus
        error={error}
        required
      />

      <TextArea
        label="Description"
        placeholder="What is this project about?"
        value={description}
        onChangeText={setDescription}
        numberOfLines={3}
      />

      <View style={styles.colorSection}>
        <Text style={styles.colorLabel}>Color</Text>
        <View style={styles.colorGrid}>
          {PROJECT_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorOption,
                { backgroundColor: c },
                color === c && styles.colorSelected,
              ]}
              onPress={() => setColor(c)}
              activeOpacity={0.7}
            >
              {color === c && (
                <CheckIcon size={20} focused={false} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancelButton: {
    marginRight: spacing.sm,
  },
  colorSection: {
    marginBottom: spacing.lg,
  },
  colorLabel: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelected: {
    borderColor: theme.text.primary,
    transform: [{ scale: 1.1 }],
  },
});
