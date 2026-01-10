/**
 * YamlActionRepository - YAML file-based implementation of ActionRepository
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as YAML from 'yaml';
import { Action, ActionType } from '../../domain/entities/Action';
import { ScopeType } from '../../domain/entities/ActionScope';
import { ActionRepository, ActionFilter } from '../../domain/repositories/ActionRepository';
import { FileSystemManager } from '../storage/FileSystemManager';

export class YamlActionRepository implements ActionRepository {
  private fileSystemManager: FileSystemManager;
  private actionsDir: string;

  constructor(fileSystemManager: FileSystemManager) {
    this.fileSystemManager = fileSystemManager;
    this.actionsDir = '';
  }

  /**
   * Initialize the repository (must be called after boards directory is set)
   */
  async initialize(): Promise<void> {
    const dataDir = this.fileSystemManager.getDataDirectory();
    this.actionsDir = `${dataDir}actions`;
    await this.ensureDirectoryStructure();
  }

  private async ensureDirectoryStructure(): Promise<void> {
    const dirs = [
      this.actionsDir,
      `${this.actionsDir}/global/reminders`,
      `${this.actionsDir}/global/automations`,
      `${this.actionsDir}/global/watchers`,
      `${this.actionsDir}/global/hooks`,
      `${this.actionsDir}/global/scheduled_jobs`,
      `${this.actionsDir}/boards`,
      `${this.actionsDir}/tasks`,
    ];

    for (const dir of dirs) {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    }
  }

  /**
   * Get file path for an action
   */
  private getActionFilePath(action: Action): string {
    const typeDir = action.type.replace('_', '_');

    if (action.scope.type === ScopeType.GLOBAL) {
      return `${this.actionsDir}/global/${typeDir}s/${action.id}.yaml`;
    } else if (action.scope.type === ScopeType.BOARD) {
      const boardDir = `${this.actionsDir}/boards/${action.scope.targetId}`;
      return `${boardDir}/${typeDir}s/${action.id}.yaml`;
    } else {
      const taskDir = `${this.actionsDir}/tasks/${action.scope.targetId}`;
      return `${taskDir}/${typeDir}s/${action.id}.yaml`;
    }
  }

  /**
   * Get all actions
   */
  async getAll(filter?: ActionFilter): Promise<Action[]> {
    const actions: Action[] = [];

    // Scan all directories
    const globalActions = await this.scanDirectory(`${this.actionsDir}/global`);
    const boardActions = await this.scanDirectory(`${this.actionsDir}/boards`);
    const taskActions = await this.scanDirectory(`${this.actionsDir}/tasks`);

    actions.push(...globalActions, ...boardActions, ...taskActions);

    // Apply filters
    if (filter) {
      return this.applyFilter(actions, filter);
    }

    return actions;
  }

  private async scanDirectory(dir: string): Promise<Action[]> {
    const actions: Action[] = [];

    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      return actions;
    }

    const scan = async (path: string): Promise<void> => {
      const normalizedPath = path.endsWith('/') ? path : `${path}/`;
      const items = await FileSystem.readDirectoryAsync(path);

      for (const name of items) {
        const fullPath = `${normalizedPath}${name}`;
        const itemInfo = await FileSystem.getInfoAsync(fullPath);

        if (itemInfo.isDirectory) {
          await scan(fullPath);
        } else if (name.endsWith('.yaml') || name.endsWith('.yml')) {
          try {
            const content = await FileSystem.readAsStringAsync(fullPath);
            const action = YAML.parse(content) as Action;
            actions.push(action);
          } catch (error) {
            console.error(`Error parsing action file ${fullPath}:`, error);
          }
        }
      }
    };

    await scan(dir);
    return actions;
  }

  /**
   * Apply filter to actions
   */
  private applyFilter(actions: Action[], filter: ActionFilter): Action[] {
    return actions.filter((action) => {
      if (filter.type && action.type !== filter.type) {
        return false;
      }

      if (filter.scopeType && action.scope.type !== filter.scopeType) {
        return false;
      }

      if (filter.targetId && action.scope.targetId !== filter.targetId) {
        return false;
      }

      if (filter.enabled !== undefined && action.enabled !== filter.enabled) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const actionTags = action.metadata?.tags || [];
        if (!filter.tags.some((tag) => actionTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get action by ID
   */
  async getById(id: string): Promise<Action | null> {
    const actions = await this.getAll();
    return actions.find((action) => action.id === id) || null;
  }

  /**
   * Get actions by scope
   */
  async getByScope(scopeType: ScopeType, targetId?: string): Promise<Action[]> {
    return this.getAll({ scopeType, targetId });
  }

  /**
   * Get actions by type
   */
  async getByType(type: ActionType): Promise<Action[]> {
    return this.getAll({ type });
  }

  /**
   * Get enabled actions only
   */
  async getEnabled(): Promise<Action[]> {
    return this.getAll({ enabled: true });
  }

  async create(action: Action): Promise<Action> {
    const filePath = this.getActionFilePath(action);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const yaml = YAML.stringify(action);
    await FileSystem.writeAsStringAsync(filePath, yaml);

    return action;
  }

  async update(action: Action): Promise<Action> {
    action.modifiedAt = new Date().toISOString();

    const existingAction = await this.getById(action.id);
    if (existingAction) {
      const oldPath = this.getActionFilePath(existingAction);
      const newPath = this.getActionFilePath(action);

      if (oldPath !== newPath) {
        const info = await FileSystem.getInfoAsync(oldPath);
        if (info.exists) {
          await FileSystem.deleteAsync(oldPath, { idempotent: true });
        }
      }
    }

    return this.create(action);
  }

  async delete(id: string): Promise<boolean> {
    const action = await this.getById(id);
    if (!action) {
      return false;
    }

    const filePath = this.getActionFilePath(action);
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      return true;
    }

    return false;
  }

  /**
   * Check if action exists
   */
  async exists(id: string): Promise<boolean> {
    const action = await this.getById(id);
    return action !== null;
  }

  /**
   * Get orphaned actions (actions whose target board/task no longer exists)
   * Note: This requires access to BoardRepository to check if boards/tasks exist
   * For now, returns empty array - should be implemented in ActionService
   */
  async getOrphaned(): Promise<Action[]> {
    // Implementation deferred to ActionService which has access to BoardRepository
    return [];
  }

  /**
   * Delete orphaned actions
   */
  async deleteOrphaned(): Promise<number> {
    const orphaned = await this.getOrphaned();
    let count = 0;

    for (const action of orphaned) {
      if (await this.delete(action.id)) {
        count++;
      }
    }

    return count;
  }
}
