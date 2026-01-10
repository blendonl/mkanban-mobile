import * as YAML from 'yaml';
import matter from 'gray-matter';
import { FileSystemManager } from "./FileSystemManager";
import { AgendaRepository } from "../../domain/repositories/AgendaRepository";
import { AgendaItem } from "../../domain/entities/AgendaItem";
import { ProjectId, BoardId, TaskId } from "../../core/types";

export class MarkdownAgendaRepository implements AgendaRepository {
  private fileSystem: FileSystemManager;

  constructor(fileSystem: FileSystemManager) {
    this.fileSystem = fileSystem;
  }

  async loadAgendaItemsForDate(date: string): Promise<AgendaItem[]> {
    try {
      const dayDir = this.fileSystem.getAgendaDayDirectoryFromDate(date);
      const exists = await this.fileSystem.directoryExists(dayDir);

      if (!exists) {
        return [];
      }

      const files = await this.fileSystem.listFiles(dayDir, '*.md');
      const items: AgendaItem[] = [];

      for (const filePath of files) {
        const item = await this.loadAgendaItemFromFile(filePath);
        if (item) {
          items.push(item);
        }
      }

      return items.sort((a, b) => {
        const timeA = a.scheduledDateTime?.getTime() || 0;
        const timeB = b.scheduledDateTime?.getTime() || 0;
        return timeA - timeB;
      });
    } catch (error) {
      console.error(`Failed to load agenda items for date ${date}:`, error);
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
      console.error(`Failed to load agenda items for date range ${startDate} to ${endDate}:`, error);
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
      console.error(`Failed to load agenda item by task ${taskId}:`, error);
      return null;
    }
  }

  async loadAgendaItemById(agendaItemId: string): Promise<AgendaItem | null> {
    try {
      const allItems = await this.loadAllAgendaItems();
      return allItems.find(item => item.id === agendaItemId) || null;
    } catch (error) {
      console.error(`Failed to load agenda item by ID ${agendaItemId}:`, error);
      return null;
    }
  }

  async loadAllAgendaItems(): Promise<AgendaItem[]> {
    try {
      const agendaDir = this.fileSystem.getAgendaDirectory();
      const exists = await this.fileSystem.directoryExists(agendaDir);

      if (!exists) {
        return [];
      }

      const allItems: AgendaItem[] = [];
      const yearDirs = await this.fileSystem.listDirectories(agendaDir);

      for (const yearDir of yearDirs) {
        const monthDirs = await this.fileSystem.listDirectories(yearDir);

        for (const monthDir of monthDirs) {
          const dayDirs = await this.fileSystem.listDirectories(monthDir);

          for (const dayDir of dayDirs) {
            const files = await this.fileSystem.listFiles(dayDir, '*.md');

            for (const filePath of files) {
              const item = await this.loadAgendaItemFromFile(filePath);
              if (item) {
                allItems.push(item);
              }
            }
          }
        }
      }

      return allItems.sort((a, b) => {
        const timeA = a.scheduledDateTime?.getTime() || 0;
        const timeB = b.scheduledDateTime?.getTime() || 0;
        return timeA - timeB;
      });
    } catch (error) {
      console.error('Failed to load all agenda items:', error);
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
    } catch (error) {
      throw new Error(`Failed to save agenda item ${item.id}: ${error}`);
    }
  }

  async deleteAgendaItem(item: AgendaItem): Promise<boolean> {
    try {
      if (!item.file_path) {
        const dayDir = this.fileSystem.getAgendaDayDirectoryFromDate(item.scheduled_date);
        const filePath = `${dayDir}${item.filename}`;
        return await this.fileSystem.deleteFile(filePath);
      }

      return await this.fileSystem.deleteFile(item.file_path);
    } catch (error) {
      console.error(`Failed to delete agenda item ${item.id}:`, error);
      return false;
    }
  }

  async getOrphanedAgendaItems(): Promise<AgendaItem[]> {
    try {
      const allItems = await this.loadAllAgendaItems();
      const orphanedItems: AgendaItem[] = [];

      for (const item of allItems) {
        const isOrphaned = await this.isTaskOrphaned(item);
        if (isOrphaned) {
          orphanedItems.push(item);
        }
      }

      return orphanedItems;
    } catch (error) {
      console.error('Failed to get orphaned agenda items:', error);
      return [];
    }
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

      return AgendaItem.fromDict(data);
    } catch (error) {
      console.error(`Failed to parse agenda item from ${filePath}:`, error);
      return null;
    }
  }

  private async isTaskOrphaned(item: AgendaItem): Promise<boolean> {
    try {
      const projectDir = this.fileSystem.getProjectDirectory(item.project_id);
      const boardDir = `${projectDir}boards/${item.board_id}/`;
      const boardFile = `${boardDir}kanban.md`;

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
      console.error(`Failed to check if task is orphaned for agenda item ${item.id}:`, error);
      return true;
    }
  }
}
