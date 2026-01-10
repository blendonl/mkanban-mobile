/**
 * Markdown Board Repository
 * High-level board operations - loading and saving entire boards
 * Ported from Python: src/infrastructure/storage/markdown_board_repository.py
 */

import { FileSystemManager } from "./FileSystemManager";
import { MarkdownParser } from "./MarkdownParser";
import { BoardPersistence } from "./BoardPersistence";
import {
  getColumnDirectoryPath,
  getTasksDirectoryPath,
} from "./FileOperations";
import { BoardRepository } from "../../domain/repositories/BoardRepository";
import { Board } from "../../domain/entities/Board";
import { Column } from "../../domain/entities/Column";
import { Task } from "../../domain/entities/Task";
import { Parent } from "../../domain/entities/Parent";
import { BoardId, ProjectId } from "../../core/types";
import { BOARD_FILENAME, COLUMN_METADATA_FILENAME } from "../../core/constants";
import { generateIdFromName } from "../../utils/stringUtils";
import { now } from "../../utils/dateUtils";

export class MarkdownBoardRepository implements BoardRepository {
  private fileSystem: FileSystemManager;
  private parser: MarkdownParser;
  private persistence: BoardPersistence;

  constructor(fileSystem: FileSystemManager) {
    this.fileSystem = fileSystem;
    this.parser = new MarkdownParser(fileSystem);
    this.persistence = new BoardPersistence(fileSystem, this.parser);
  }

  /**
   * Load boards from a specific directory (project boards directory)
   */
  async loadBoardsFromDirectory(directory: string): Promise<Board[]> {
    try {
      console.log("Loading boards from", directory);
      const boards: Board[] = [];

      await this.fileSystem.ensureDirectoryExists(directory);

      const boardDirs = await this.fileSystem.listDirectories(directory);
      const projectSlug = this.extractProjectSlugFromPath(directory);

      for (const boardDir of boardDirs) {
        const kanbanFile = `${boardDir}${BOARD_FILENAME}`;
        const exists = await this.fileSystem.fileExists(kanbanFile);

        if (exists) {
          const board = await this.loadBoardFromFile(kanbanFile, projectSlug);
          if (board) {
            boards.push(board);
          }
        }
      }

      console.log(`Loaded ${boards.length} boards from ${directory}`);
      return boards;
    } catch (error) {
      console.error(`Failed to load boards from ${directory}:`, error);
      return [];
    }
  }

  /**
   * Load a board by its ID
   * Searches across all projects for the board
   */
  async loadBoardById(boardId: BoardId): Promise<Board | null> {
    try {
      console.log("Loading board by ID:", boardId);

      const projectDirs = await this.fileSystem.listProjects();

      for (const projectSlug of projectDirs) {
        const projectBoardsDir =
          this.fileSystem.getProjectBoardsDirectory(projectSlug);
        const boardDirs =
          await this.fileSystem.listDirectories(projectBoardsDir);

        for (const boardDir of boardDirs) {
          const kanbanFile = `${boardDir}${BOARD_FILENAME}`;
          const exists = await this.fileSystem.fileExists(kanbanFile);

          if (exists) {
            const board = await this.loadBoardFromFile(kanbanFile, projectSlug);
            if (board && board.id === boardId) {
              console.log("Found board by ID:", board.name);
              return board;
            }
          }
        }
      }

      console.warn("Board not found by ID:", boardId);
      return null;
    } catch (error) {
      console.error("Failed to load board by ID:", error);
      return null;
    }
  }

  /**
   * Load a board from its kanban.md file
   */
  async loadBoardFromFile(
    kanbanFile: string,
    projectSlug?: string | null,
  ): Promise<Board | null> {
    try {
      const parsed = await this.parser.parseBoardMetadata(kanbanFile);
      const boardName = parsed.name;
      const metadata = parsed.metadata;

      const boardDir = this.getParentDirectory(kanbanFile);

      const extractedProjectSlug =
        projectSlug || this.extractProjectSlugFromPath(kanbanFile);

      if (!extractedProjectSlug) {
        console.error(`Cannot determine project_id for board at ${kanbanFile}`);
        return null;
      }

      let board = new Board({
        id: metadata.id || this.getBoardDirName(boardDir),
        name: boardName,
        project_id: extractedProjectSlug,
        description: metadata.description || "",
        created_at: metadata.created_at ? new Date(metadata.created_at) : now(),
        file_path: kanbanFile,
      });

      board = await this.loadColumnsForBoard(board, boardDir);

      console.log(board);

      this.loadParentsForBoard(board, metadata);

      return board;
    } catch (error) {
      console.error(`Failed to load board from file ${kanbanFile}:`, error);
      return null;
    }
  }

  /**
   * Save a board (metadata, columns, tasks, parents) to project directory
   */
  async saveBoard(board: Board, projectSlug: string): Promise<void> {
    try {
      console.log("Saving board:", board.name, "for project:", projectSlug);

      const projectBoardsDir =
        this.fileSystem.getProjectBoardsDirectory(projectSlug);
      const boardDir = `${projectBoardsDir}${generateIdFromName(board.name)}/`;
      const kanbanFile = `${boardDir}${BOARD_FILENAME}`;

      await this.fileSystem.ensureDirectoryExists(boardDir);

      const boardData: Record<string, any> = {
        id: board.id,
        name: board.name,
        project_id: board.project_id,
        description: board.description,
        created_at: board.created_at,
        parents: board.parents.map((parent) => ({
          id: parent.id,
          name: parent.name,
          color: parent.color,
          created_at: parent.created_at,
        })),
      };

      await this.parser.saveBoardMetadata(kanbanFile, board.name, boardData);
      await this.saveColumnsForBoard(board, boardDir);

      console.log("Successfully saved board:", board.name);
    } catch (error) {
      throw new Error(`Failed to save board "${board.name}": ${error}`);
    }
  }

  /**
   * Delete a board by its ID
   */
  async deleteBoard(boardId: BoardId): Promise<boolean> {
    try {
      console.log("Deleting board:", boardId);

      const board = await this.loadBoardById(boardId);
      if (!board) {
        console.warn("Cannot delete non-existent board:", boardId);
        return false;
      }

      const projectBoardsDir = this.fileSystem.getProjectBoardsDirectory(
        board.project_id,
      );
      const boardDir = `${projectBoardsDir}${generateIdFromName(board.name)}/`;

      const deleted = await this.fileSystem.deleteDirectory(boardDir);

      if (deleted) {
        console.log("Successfully deleted board:", board.name);
      }

      return deleted;
    } catch (error) {
      console.error("Failed to delete board:", error);
      return false;
    }
  }

  /**
   * Create a sample board with default columns for a project
   */
  async createSampleBoard(name: string, projectId: ProjectId): Promise<Board> {
    console.log("Creating sample board:", name, "for project:", projectId);

    const board = new Board({
      name,
      project_id: projectId,
      description: "Sample board for getting started",
    });

    board.addColumn("To Do", 0);
    board.addColumn("In Progress", 1);
    board.addColumn("Done", 2);

    board.addParent("Sample Project", "blue");

    console.log("Created sample board:", name);
    return board;
  }

  /**
   * Load columns for a board from the file system
   */
  private async loadColumnsForBoard(
    board: Board,
    boardDir: string,
  ): Promise<Board> {
    try {
      const columnsDir = `${boardDir}columns/`;
      const columnsDirExists =
        await this.fileSystem.directoryExists(columnsDir);

      if (!columnsDirExists) {
        return board;
      }

      const columnDirs = await this.fileSystem.listDirectories(columnsDir);

      // Sort column directories alphabetically
      columnDirs.sort();

      // First pass: load columns with explicit positions from metadata
      const columnsWithPositions: Array<{ column: Column; columnDir: string }> =
        [];
      const columnsWithoutPositions: Array<{
        column: Column;
        columnDir: string;
      }> = [];
      const usedPositions = new Set<number>();

      for (const columnDir of columnDirs) {
        const columnMetadataFile = `${columnDir}${COLUMN_METADATA_FILENAME}`;
        const metadataExists =
          await this.fileSystem.fileExists(columnMetadataFile);

        let column: Column;
        const columnDirName = this.getDirectoryName(columnDir);

        if (metadataExists) {
          try {
            const metadata =
              await this.parser.parseColumnMetadata(columnMetadataFile);
            if (metadata) {
              const position = metadata.position;
              column = new Column({
                id: metadata.id || columnDirName,
                name: metadata.name || this.formatColumnName(columnDirName),
                position: position !== undefined ? position : 0,
                limit: metadata.limit,
                created_at: metadata.created_at
                  ? new Date(metadata.created_at)
                  : now(),
                file_path: columnMetadataFile,
              });

              if (position !== undefined && position !== null) {
                usedPositions.add(position);
                columnsWithPositions.push({ column, columnDir });
              } else {
                columnsWithoutPositions.push({ column, columnDir });
              }
            } else {
              // Metadata file exists but empty
              column = new Column({
                id: columnDirName,
                name: this.formatColumnName(columnDirName),
                file_path: columnDir,
              });
              columnsWithoutPositions.push({ column, columnDir });
            }
          } catch (error) {
            // Failed to parse metadata, use defaults
            column = new Column({
              id: columnDirName,
              name: this.formatColumnName(columnDirName),
              file_path: columnDir,
            });
            columnsWithoutPositions.push({ column, columnDir });
          }
        } else {
          // No metadata file
          column = new Column({
            id: columnDirName,
            name: this.formatColumnName(columnDirName),
            file_path: columnDir,
          });
          columnsWithoutPositions.push({ column, columnDir });
        }
      }

      // Second pass: assign positions to columns without explicit positions
      let nextPosition = 0;
      for (const { column, columnDir } of columnsWithoutPositions) {
        while (usedPositions.has(nextPosition)) {
          nextPosition++;
        }
        column.position = nextPosition;
        usedPositions.add(nextPosition);
        nextPosition++;
      }

      // Load tasks for all columns
      const allColumns = [...columnsWithPositions, ...columnsWithoutPositions];
      for (const { column, columnDir } of allColumns) {
        await this.loadTasksForColumn(column, columnDir);
        board.columns.push(column);
      }

      // Sort columns by position, then by name
      board.columns.sort((a, b) => {
        if (a.position !== b.position) {
          return a.position - b.position;
        }
        return a.name.localeCompare(b.name);
      });

      return board;
    } catch (error) {
      console.error("Failed to load columns for board:", error);
      return board;
    }
  }

  /**
   * Load tasks for a column from the file system
   */
  private async loadTasksForColumn(
    column: Column,
    columnDir: string,
  ): Promise<void> {
    try {
      const taskFolders = await this.fileSystem.listDirectories(columnDir);

      for (const taskFolder of taskFolders) {
        const taskFile = `${taskFolder}task.md`;

        if (!await this.fileSystem.fileExists(taskFile)) {
          continue;
        }

        try {
          const parsed = await this.parser.parseTaskMetadata(taskFile);
          const title = parsed.title;
          const content = parsed.content;
          const metadata = parsed.metadata;

          const timingMetadata = {
            moved_in_progress_at: metadata.moved_in_progress_at
              ? new Date(metadata.moved_in_progress_at)
              : null,
            moved_in_done_at: metadata.moved_in_done_at
              ? new Date(metadata.moved_in_done_at)
              : null,
            worked_on_for: metadata.worked_on_for || null,
          };

          const normalizedColumnId = column.id.replace(/_/g, "-");

          if (
            normalizedColumnId !== "in-progress" &&
            normalizedColumnId !== "done"
          ) {
            timingMetadata.moved_in_progress_at = null;
            timingMetadata.moved_in_done_at = null;
            timingMetadata.worked_on_for = null;
          } else if (normalizedColumnId === "in-progress") {
            timingMetadata.moved_in_done_at = null;
            timingMetadata.worked_on_for = null;
          }

          const task = new Task({
            id: metadata.id || generateIdFromName(title),
            title: metadata.title || title,
            description: metadata.description || content || "",
            column_id: column.id,
            parent_id: metadata.parent_id || null,
            project_id: metadata.project_id || null,
            created_at: metadata.created_at
              ? new Date(metadata.created_at)
              : now(),
            moved_in_progress_at: timingMetadata.moved_in_progress_at,
            moved_in_done_at: timingMetadata.moved_in_done_at,
            worked_on_for: timingMetadata.worked_on_for,
            file_path: taskFile,
            scheduled_date: metadata.scheduled_date || null,
            scheduled_time: metadata.scheduled_time || null,
            time_block_minutes: metadata.time_block_minutes || null,
            task_type: metadata.task_type || "regular",
            calendar_event_id: metadata.calendar_event_id || null,
            recurrence: metadata.recurrence || null,
            meeting_data: metadata.meeting_data || null,
          });

          column.tasks.push(task);
        } catch (error) {
          console.warn(`Skipping corrupted task file ${taskFile}:`, error);
          continue;
        }
      }
    } catch (error) {
      console.error("Failed to load tasks for column:", error);
    }
  }

  /**
   * Load parents for a board from metadata
   */
  private loadParentsForBoard(
    board: Board,
    metadata: Record<string, any>,
  ): void {
    const parentsData = metadata.parents || [];

    for (const parentData of parentsData) {
      const parent = new Parent({
        id: parentData.id || generateIdFromName(parentData.name || ""),
        name: parentData.name || "",
        color: parentData.color || "blue",
        created_at: parentData.created_at
          ? new Date(parentData.created_at)
          : now(),
      });
      board.parents.push(parent);
    }
  }

  /**
   * Save all columns for a board
   */
  private async saveColumnsForBoard(
    board: Board,
    boardDir: string,
  ): Promise<void> {
    try {
      const projectBoardsDir = this.fileSystem.getProjectBoardsDirectory(
        board.project_id,
      );

      // Get existing column directories
      const existingColumnDirs =
        await this.fileSystem.listDirectories(boardDir);
      const existingColumnNames = new Set(
        existingColumnDirs.map((dir) => this.getDirectoryName(dir)),
      );

      // Get board column directory names
      const boardColumnNames = new Set(
        board.columns.map((col) => generateIdFromName(col.name)),
      );

      // Remove columns that no longer exist
      for (const dirName of existingColumnNames) {
        if (!boardColumnNames.has(dirName)) {
          const columnDir = `${boardDir}${dirName}/`;
          await this.fileSystem.deleteDirectory(columnDir);
        }
      }

      // Save each column
      for (const column of board.columns) {
        const columnDir = getColumnDirectoryPath(boardDir, column.name);

        // Save column metadata
        await this.persistence.saveColumnMetadata(
          projectBoardsDir,
          board.name,
          column.name,
          {
            id: column.id,
            name: column.name,
            position: column.position,
            limit: column.limit,
            created_at: column.created_at,
          },
        );

        for (const task of column.tasks) {
          await this.persistence.saveTaskToColumn(
            projectBoardsDir,
            board.name,
            column.name,
            task.toDict(),
          );
        }
      }
    } catch (error) {
      console.error("Failed to save columns for board:", error);
      throw error;
    }
  }

  /**
   * Get parent directory from a path
   */
  private getParentDirectory(path: string): string {
    const parts = path.split("/");
    parts.pop();
    return parts.join("/") + "/";
  }

  /**
   * Get directory name from path (last segment)
   */
  private getDirectoryName(path: string): string {
    const parts = path.split("/").filter((p) => p.length > 0);
    return parts[parts.length - 1];
  }

  /**
   * Get board directory name from path
   */
  private getBoardDirName(boardDir: string): string {
    return this.getDirectoryName(boardDir);
  }

  /**
   * Format column name from directory name
   * Converts "to-do" -> "To Do", "in-progress" -> "In Progress"
   */
  private formatColumnName(dirName: string): string {
    return dirName
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Get file stem (filename without extension)
   */
  private getFileStem(filePath: string): string {
    const parts = filePath.split("/");
    const filename = parts[parts.length - 1];
    return filename.replace(/\.md$/, "");
  }

  /**
   * Extract project slug from a path
   * Example: "storage/projects/my-project/boards/default/kanban.md" -> "my-project"
   */
  private extractProjectSlugFromPath(path: string): string | null {
    const parts = path.split("/").filter((p) => p.length > 0);
    const projectsIndex = parts.indexOf("projects");

    if (projectsIndex !== -1 && projectsIndex + 1 < parts.length) {
      return parts[projectsIndex + 1];
    }

    return null;
  }
}
