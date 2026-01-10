import { FileSystemManager } from "./FileSystemManager";
import { MarkdownParser } from "./MarkdownParser";
import { getTasksDirectoryPath, getUniqueFolderName } from "./FileOperations";
import { generateIdFromName } from "../../utils/stringUtils";
import { COLUMN_METADATA_FILENAME } from "../../core/constants";

export class TaskStorageMigration {
  constructor(
    private fileSystem: FileSystemManager,
    private parser: MarkdownParser
  ) {}

  async migrateProjectIfNeeded(projectSlug: string): Promise<void> {
    const boardsDir = this.fileSystem.getProjectBoardsDirectory(projectSlug);
    const boardDirs = await this.fileSystem.listDirectories(boardsDir);

    for (const boardDir of boardDirs) {
      await this.migrateBoardIfNeeded(boardDir);
    }
  }

  private async migrateBoardIfNeeded(boardDir: string): Promise<void> {
    const markerFile = `${boardDir}.migrated-task-storage`;

    if (await this.fileSystem.fileExists(markerFile)) {
      return;
    }

    const columnsDir = `${boardDir}columns/`;
    if (!await this.fileSystem.directoryExists(columnsDir)) {
      return;
    }

    const columnDirs = await this.fileSystem.listDirectories(columnsDir);

    for (const columnDir of columnDirs) {
      await this.migrateColumnTasks(columnDir);
    }

    await this.fileSystem.writeFile(markerFile, `Migrated at ${new Date().toISOString()}`);
    console.log(`Migration complete for board: ${boardDir}`);
  }

  private async migrateColumnTasks(columnDir: string): Promise<void> {
    const tasksDir = getTasksDirectoryPath(columnDir);

    if (!await this.fileSystem.directoryExists(tasksDir)) {
      return;
    }

    const taskFiles = await this.fileSystem.listFiles(tasksDir, "*.md");

    for (const oldTaskFile of taskFiles) {
      if (oldTaskFile.endsWith(COLUMN_METADATA_FILENAME)) {
        continue;
      }

      try {
        const parsed = await this.parser.parseTaskMetadata(oldTaskFile);
        const taskId = parsed.metadata.id || generateIdFromName(parsed.title);
        const title = parsed.metadata.title || parsed.title;

        const folderName = await getUniqueFolderName(
          this.fileSystem,
          this.parser,
          columnDir,
          title,
          taskId
        );

        const taskFolder = `${columnDir}${folderName}/`;
        const newTaskFile = `${taskFolder}task.md`;

        await this.fileSystem.ensureDirectoryExists(taskFolder);
        await this.fileSystem.renameFile(oldTaskFile, newTaskFile);

        console.log(`Migrated task ${taskId}: ${oldTaskFile} -> ${newTaskFile}`);
      } catch (error) {
        console.error(`Failed to migrate task ${oldTaskFile}:`, error);
      }
    }

    const remainingFiles = await this.fileSystem.listFiles(tasksDir);
    if (remainingFiles.length === 0) {
      await this.fileSystem.deleteDirectory(tasksDir);
    }
  }
}
