import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import BaseModal from './BaseModal';
import theme from '../theme';
import AppIcon from './icons/AppIcon';

interface ValueInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (value: number) => void;
  title?: string;
  valueUnit?: string | null;
  currentValue?: number;
  targetValue?: number | null;
}

export default function ValueInputModal({
  visible,
  onClose,
  onSave,
  title = 'Log Progress',
  valueUnit,
  currentValue = 0,
  targetValue,
}: ValueInputModalProps) {
  const [value, setValue] = useState(currentValue.toString());

  const handleSave = () => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      onSave(numValue);
      onClose();
    }
  };

  const incrementValue = (amount: number) => {
    const current = parseFloat(value) || 0;
    setValue((current + amount).toString());
  };

  const progress = targetValue && targetValue > 0
    ? Math.min(100, (parseFloat(value) / targetValue) * 100)
    : 0;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.content}>
        {targetValue && (
          <View style={styles.targetContainer}>
            <Text style={styles.targetLabel}>
              Target: {targetValue} {valueUnit || 'units'}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={theme.text.secondary}
            autoFocus
          />
          {valueUnit && (
            <Text style={styles.unit}>{valueUnit}</Text>
          )}
        </View>

        <View style={styles.quickButtons}>
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => incrementValue(100)}
          >
            <AppIcon name="plus" size={16} color={theme.primary} />
            <Text style={styles.quickButtonText}>+100</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => incrementValue(500)}
          >
            <AppIcon name="plus" size={16} color={theme.primary} />
            <Text style={styles.quickButtonText}>+500</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => incrementValue(1000)}
          >
            <AppIcon name="plus" size={16} color={theme.primary} />
            <Text style={styles.quickButtonText}>+1000</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.lg,
  },
  targetContainer: {
    gap: theme.spacing.sm,
  },
  targetLabel: {
    ...theme.typography.textStyles.body,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.card.background,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.primary,
  },
  progressText: {
    ...theme.typography.textStyles.caption,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.input.background,
    borderRadius: theme.radius.input,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  input: {
    flex: 1,
    ...theme.typography.textStyles.h2,
    color: theme.text.primary,
    textAlign: 'center',
  },
  unit: {
    ...theme.typography.textStyles.body,
    color: theme.text.secondary,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.button,
    backgroundColor: theme.card.background,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  quickButtonText: {
    ...theme.typography.textStyles.caption,
    color: theme.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.button,
    backgroundColor: theme.card.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.text.primary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.button,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    ...theme.typography.textStyles.body,
    color: theme.button.text,
  },
});
