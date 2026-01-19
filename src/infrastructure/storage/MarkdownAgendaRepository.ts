import * as YAML from 'yaml';
import matter from 'gray-matter';
import { FileSystemManager } from "./FileSystemManager";
import { AgendaRepository } from "../../domain/repositories/AgendaRepository";
import { AgendaItem } from "../../domain/entities/AgendaItem";
import { ProjectId, BoardId, TaskId } from "../../core/types";
import { logger } from "../../utils/logger";

export class MarkdownAgendaRepository implements AgendaRepository {
  private fileSystem: FileSystemManager;
  private taskIndexCache: Map<string, Set<string>> | null = null;
  private taskIndexTimestamp = 0;
  private readonly TASK_INDEX_TTL = 5 * 60 * 1000;
  private allItemsCache: AgendaItem[] | null = null;
  private allItemsCacheTimestamp = 0;
  private readonly ALL_ITEMS_CACHE_TTL = 5 * 60 * 1000;

  constructor(fileSystem: FileSystemManager) {
    this.fileSystem = fileSystem;
  }

  async loadAgendaItemsForDate(date: string): Promise<AgendaItem[]> {
    try {
      const dayDir = this.fileSystem.getAgendaDayDirectoryFromDate(date);
      logger.debug(`[AgendaRepository] Checking directory: ${dayDir}`);
      const exists = await this.fileSystem.directoryExists(dayDir);
      logger.debug(`[AgendaRepository] Directory exists: ${exists}`);

      if (!exists) {
        return [];
      }

      const files = await this.fileSystem.listFiles(dayDir, '*.md');
      logger.debug(`[AgendaRepository] Found ${files.length} .md files in ${dayDir}`);
      const items: AgendaItem[] = [];

      for (const filePath of files) {
        const item = await this.loadAgendaItemFromFile(filePath);
        if (item) {
          items.push(item);
        }
      }

      logger.debug(`[AgendaRepository] Loaded ${items.length} agenda items for ${date}`);
      return items.sort((a, b) => {
        const timeA = a.scheduledDateTime?.getTime() || 0;
        const timeB = b.scheduledDateTime?.getTime() || 0;
        return timeA - timeB;
      });
    } catch (error) {
      logger.error(`Failed to load agenda items for date ${date}:`, error);
      return [];
    }
  }

  async loadAgendaItemsForDateRange(startDate: string, endDate: string): Promise<AgendaItem[]> {
    try {
      const allItems: AgendaItem[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayItems = await this.loadAgendaItemsForDate(dateStr);
        allItems.push(...dayItems);
      }

      return allItems.sort((a, b) => {
        const timeA = a.scheduledDateTime?.getTime() || 0;
        const timeB = b.scheduledDateTime?.getTime() || 0;
        return timeA - timeB;
      });
    } catch (error) {
      logger.error(`Failed to load agenda items for date range ${startDate} to ${endDate}:`, error);
      return [];
    }
  }

  async loadAgendaItemByTask(
    projectId: ProjectId,
    boardId: BoardId,
    taskId: TaskId
  ): Promise<AgendaItem | null> {
    try {
      const allItems = await this.loadAllAgendaItems();
      return allItems.find(
        item =>
          item.project_id === projectId &&
          item.board_id === boardId &&
          item.task_id === taskId
      ) || null;
    } catch (error) {
      logger.error(`Failed to load agenda item by task ${taskId}:`, error);
      return null;
    }
  }

  async loadAgendaItemsByTask(
    projectId: ProjectId,
    boardId: BoardId,
    taskId: TaskId
  ): Promise<AgendaItem[]> {
    try {
      const allItems = await this.loadAllAgendaItems();
      return allItems.filter(
        item =>
          item.project_id === projectId &&
          item.board_id === boardId &&
          item.task_id === taskId
      );
    } catch (error) {
      logger.error(`Failed to load agenda items by task ${taskId}:`, error);
      return [];
    }
  }

  async loadAgendaItemById(agendaItemId: string): Promise<AgendaItem | null> {
    try {
      const allItems = await this.loadAllAgendaItems();
      return allItems.find(item => item.id === agendaItemId) || null;
    } catch (error) {
      logger.error(`Failed to load agenda item by ID ${agendaItemId}:`, error);
      return null;
    }
  }

  async loadAllAgendaItems(): Promise<AgendaItem[]> {
    if (this.allItemsCache &&
        (Date.now() - this.allItemsCacheTimestamp) < this.ALL_ITEMS_CACHE_TTL) {
      return this.allItemsCache;
    }

    const items = await this.loadAllAgendaItemsUncached();
    this.allItemsCache = items;
    this.allItemsCacheTimestamp = Date.now();
    return items;
  }

  private async loadAllAgendaItemsUncached(): Promise<AgendaItem[]> {
    try {
      const BATCH_SIZE = 10;
      const agendaDir = this.fileSystem.getAgendaDirectory();
      const exists = await this.fileSystem.directoryExists(agendaDir);

      if (!exists) {
        return [];
      }

      const yearDirs = await this.fileSystem.listDirectories(agendaDir);
      const allItems: AgendaItem[] = [];

      for (const yearDir of yearDirs) {
        const monthDirs = await this.fileSystem.listDirectories(yearDir);

        for (let i = 0; i < monthDirs.length; i += BATCH_SIZE) {
          const monthBatch = monthDirs.slice(i, i + BATCH_SIZE);
          const monthResults = await Promise.all(
            monthBatch.map(async (monthDir) => {
              const dayDirs = await this.fileSystem.listDirectories(monthDir);
              const dayItems: AgendaItem[] = [];

              for (const dayDir of dayDirs) {
                const files = await this.fileSystem.listFiles(dayDir, '*.md');

                for (let j = 0; j < files.length; j += BATCH_SIZE) {
                  const fileBatch = files.slice(j, j + BATCH_SIZE);
                  const fileResults = await Promise.all(
                    fileBatch.map(async (filePath) => {
                      const item = await this.loadAgendaItemFromFile(filePath);
                      return item;
                    })
                  );

                  dayItems.push(...fileResults.filter((item): item is AgendaItem => item !== null));
                }
              }

              return dayItems;
            })
          );

          allItems.push(...monthResults.flat());
        }
      }

      return allItems.sort((a, b) => {
        const timeA = a.scheduledDateTime?.getTime() || 0;
        const timeB = b.scheduledDateTime?.getTime() || 0;
        return timeA - timeB;
      });
    } catch (error) {
      logger.error('Failed to load all agenda items:', error);
      return [];
    }
  }

  async saveAgendaItem(item: AgendaItem): Promise<void> {
    try {
      const dayDir = this.fileSystem.getAgendaDayDirectoryFromDate(item.scheduled_date);
      await this.fileSystem.ensureDirectoryExists(dayDir);

      const filePath = `${dayDir}${item.filename}`;

      const oldFilePath = item.file_path;
      if (oldFilePath && oldFilePath !== filePath) {
        const oldExists = await this.fileSystem.fileExists(oldFilePath);
        if (oldExists) {
          await this.fileSystem.deleteFile(oldFilePath);
        }
      }

      const metadata = item.toDict();
      const content = item.notes || `# Scheduled Task\n\n## Notes\n\n${item.notes || 'No notes yet.'}`;

      const yamlStr = YAML.stringify(metadata);
      const fullContent = `---\n${yamlStr}---\n\n${content}`;

      await this.fileSystem.writeFile(filePath, fullContent);

      item.file_path = filePath;
      this.allItemsCache = null;
    } catch (error) {
      throw new Error(`Failed to save agenda item ${item.id}: ${error}`);
    }
  }

  async deleteAgendaItem(item: AgendaItem): Promise<boolean> {
    try {
      if (!item.file_path) {
        const dayDir = this.fileSystem.getAgendaDayDirectoryFromDate(item.scheduled_date);
        const filePath = `${dayDir}${item.filename}`;
        const result = await this.fileSystem.deleteFile(filePath);
        this.allItemsCache = null;
        return result;
      }

      const result = await this.fileSystem.deleteFile(item.file_path);
      this.allItemsCache = null;
      return result;
    } catch (error) {
      logger.error(`Failed to delete agenda item ${item.id}:`, error);
      return false;
    }
  }

  async getOrphanedAgendaItems(): Promise<AgendaItem[]> {
    try {
      const allItems = await this.loadAllAgendaItems();
      const taskIndex = await this.getCachedTaskIndex();

      const orphanedItems = allItems.filter(item => {
        const boardTasks = taskIndex.get(item.board_id);
        if (!boardTasks) {
          return true;
        }
        return !boardTasks.has(item.task_id);
      });

      return orphanedItems;
    } catch (error) {
      logger.error('Failed to get orphaned agenda items:', error);
      return [];
    }
  }

  async loadUnfinishedItems(beforeDate?: string): Promise<AgendaItem[]> {
    try {
      const allItems = await this.loadAllAgendaItems();
      const cutoffDate = beforeDate ? new Date(beforeDate) : new Date();

      return allItems.filter(item => {
        if (!item.is_unfinished) return false;
        if (!beforeDate) return true;

        const itemDate = new Date(item.scheduled_date);
        return itemDate < cutoffDate;
      }).sort((a, b) => {
        const timeA = a.scheduledDateTime?.getTime() || 0;
        const timeB = b.scheduledDateTime?.getTime() || 0;
        return timeB - timeA;
      });
    } catch (error) {
      logger.error('Failed to load unfinished agenda items:', error);
      return [];
    }
  }

  private async getCachedTaskIndex(): Promise<Map<string, Set<string>>> {
    if (this.taskIndexCache && (Date.now() - this.taskIndexTimestamp) < this.TASK_INDEX_TTL) {
      logger.debug('[AgendaRepository] Using cached task index');
      return this.taskIndexCache;
    }

    logger.debug('[AgendaRepository] Building fresh task index');
    this.taskIndexCache = await this.buildTaskIndex();
    this.taskIndexTimestamp = Date.now();
    return this.taskIndexCache;
  }

  private async buildTaskIndex(): Promise<Map<string, Set<string>>> {
    const taskIndex = new Map<string, Set<string>>();

    try {
      const projectService = (await import('../../../core/DependencyContainer')).getProjectService();
      const projects = await projectService.getAllProjects();

      await Promise.all(
        projects.map(async (project) => {
          const boardsDir = this.fileSystem.getProjectBoardsDirectory(project.slug);
          const boardDirs = await this.fileSystem.listDirectories(boardsDir);

          await Promise.all(
            boardDirs.map(async (boardDir) => {
              const boardId = boardDir.split('/').filter(Boolean).pop() || '';
              const columnsDir = `${boardDir}columns/`;

              try {
                const columnDirs = await this.fileSystem.listDirectories(columnsDir);
                const taskIds = new Set<string>();

                const allTaskIds = await Promise.all(
                  columnDirs.map(async (columnDir) => {
                    const taskFiles = await this.fileSystem.listFiles(columnDir, '*.md');
                    const ids = await Promise.all(
                      taskFiles.map(async (taskFile) => {
                        try {
                          const taskContent = await this.fileSystem.readFile(taskFile);
                          const taskParsed = matter(taskContent);
                          return taskParsed.data.id as string;
                        } catch {
                          return null;
                        }
                      })
                    );
                    return ids.filter((id): id is string => id !== null);
                  })
                );

                allTaskIds.flat().forEach(id => taskIds.add(id));
                taskIndex.set(boardId, taskIds);
              } catch (error) {
                console.warn(`Failed to build task index for board ${boardId}:`, error);
              }
            })
          );
        })
      );
    } catch (error) {
      logger.error('Failed to build task index:', error);
    }

    return taskIndex;
  }

  private async loadAgendaItemFromFile(filePath: string): Promise<AgendaItem | null> {
    try {
      const content = await this.fileSystem.readFile(filePath);
      const parsed = matter(content);

      const data = {
        ...parsed.data,
        file_path: filePath,
        notes: parsed.content.trim(),
      };

      if (data.scheduled_date instanceof Date) {
        data.scheduled_date = data.scheduled_date.toISOString().split('T')[0];
      }
      if (data.created_at instanceof Date) {
        data.created_at = data.created_at.toISOString();
      }
      if (data.updated_at instanceof Date) {
        data.updated_at = data.updated_at.toISOString();
      }

      return AgendaItem.fromDict(data);
    } catch (error) {
      logger.error(`Failed to parse agenda item from ${filePath}:`, error);
      return null;
    }
  }

  private async isTaskOrphaned(item: AgendaItem): Promise<boolean> {
    try {
      const projectDir = this.fileSystem.getProjectDirectory(item.project_id);
      const boardDir = `${projectDir}boards/${item.board_id}/`;
      const boardFile = `${boardDir}board.md`;

      const boardExists = await this.fileSystem.fileExists(boardFile);
      if (!boardExists) {
        return true;
      }

      const columnsDir = `${boardDir}columns/`;
      const columnDirs = await this.fileSystem.listDirectories(columnsDir);

      for (const columnDir of columnDirs) {
        const taskFiles = await this.fileSystem.listFiles(columnDir, '*.md');
        for (const taskFile of taskFiles) {
          const taskContent = await this.fileSystem.readFile(taskFile);
          const taskParsed = matter(taskContent);
          if (taskParsed.data.id === item.task_id) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      logger.error(`Failed to check if task is orphaned for agenda item ${item.id}:`, error);
      return true;
    }
  }
}
