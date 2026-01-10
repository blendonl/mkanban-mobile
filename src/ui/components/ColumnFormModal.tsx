import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { Column } from '../../domain/entities/Column';
import BaseModal from './BaseModal';
import { Input } from './Input';
import { PrimaryButton, SecondaryButton } from './Button';
import theme from '../theme';
import alertService from '../../services/AlertService';

interface ColumnFormModalProps {
  visible: boolean;
  column?: Column | null;  // If editing, pass existing column
  existingColumns: Column[];  // For duplicate name check
  onSave: (name: string, limit?: number, columnId?: string) => Promise<void>;
  onClose: () => void;
}

export default function ColumnFormModal({
  visible,
  column,
  existingColumns,
  onSave,
  onClose,
}: ColumnFormModalProps) {
  const [name, setName] = useState('');
  const [limitValue, setLimitValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!column;

  // Initialize form when column changes
  useEffect(() => {
    if (column) {
      setName(column.name);
      setLimitValue(column.limit ? column.limit.toString() : '');
    } else {
      setName('');
      setLimitValue('');
    }
  }, [column, visible]);

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      alertService.showValidationError('Column name is required');
      return;
    }

    if (trimmedName.length > theme.ui.BOARD_NAME_MAX_LENGTH) {
      alertService.showValidationError(`Column name must be ${theme.ui.BOARD_NAME_MAX_LENGTH} characters or less`);
      return;
    }

    // Check for duplicate names (case-insensitive), excluding current column if editing
    const duplicateExists = existingColumns.some(
      (col) =>
        col.name.toLowerCase() === trimmedName.toLowerCase() &&
        col.id !== column?.id
    );

    if (duplicateExists) {
      alertService.showValidationError('A column with this name already exists');
      return;
    }

    // Parse and validate WIP limit
    let limit: number | undefined;
    if (limitValue.trim()) {
      const parsedLimit = parseInt(limitValue, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        alertService.showValidationError('WIP limit must be a positive number');
        return;
      }
      limit = parsedLimit;
    }

    try {
      setIsSaving(true);
      await onSave(trimmedName, limit, column?.id);
      handleClose();
    } catch (error) {
      alertService.showError(`Failed to save column: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setLimitValue('');
    onClose();
  };

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      title={isEditing ? 'Edit Column' : 'New Column'}
      scrollable
      footer={
        <View style={styles.footer}>
          <SecondaryButton
            title="Cancel"
            onPress={handleClose}
            disabled={isSaving}
          />
          <PrimaryButton
            title={isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            onPress={handleSave}
            disabled={isSaving}
            loading={isSaving}
          />
        </View>
      }
    >
      <View style={styles.field}>
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g., To Do, In Progress, Done"
          autoFocus={!isEditing}
          maxLength={theme.ui.BOARD_NAME_MAX_LENGTH}
          required
        />
      </View>

      <View style={styles.field}>
        <Input
          label="WIP Limit (Optional)"
          value={limitValue}
          onChangeText={setLimitValue}
          placeholder="e.g., 5"
          keyboardType="number-pad"
          helperText="Maximum number of tasks allowed in this column"
        />
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: theme.spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
});
