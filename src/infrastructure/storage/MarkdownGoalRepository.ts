import * as YAML from 'yaml';
import { FileSystemManager } from "./FileSystemManager";
import { GoalRepository } from "../../domain/repositories/GoalRepository";
import { Goal } from "../../domain/entities/Goal";
import { GoalId } from "../../core/types";
import { getSafeFilename } from "../../utils/stringUtils";

export class MarkdownGoalRepository implements GoalRepository {
  constructor(private fileSystem: FileSystemManager) {}

  async loadAllGoals(): Promise<Goal[]> {
    try {
      const goalsDir = this.fileSystem.getGoalsDirectory();
      const exists = await this.fileSystem.directoryExists(goalsDir);
      if (!exists) {
        return [];
      }

      const files = await this.fileSystem.listFiles(goalsDir, '*.yml');
      const goals: Goal[] = [];

      for (const filePath of files) {
        const goal = await this.loadGoalFromFile(filePath);
        if (goal) {
          goals.push(goal);
        }
      }

      return goals;
    } catch (error) {
      console.error("Failed to load goals:", error);
      return [];
    }
  }

  async loadGoalById(goalId: GoalId): Promise<Goal | null> {
    try {
      const goalFile = this.getGoalFilePath(goalId);
      const exists = await this.fileSystem.fileExists(goalFile);
      if (!exists) {
        return null;
      }
      return await this.loadGoalFromFile(goalFile);
    } catch (error) {
      console.error(`Failed to load goal by id ${goalId}:`, error);
      return null;
    }
  }

  async saveGoal(goal: Goal): Promise<void> {
    try {
      const goalsDir = this.fileSystem.getGoalsDirectory();
      await this.fileSystem.ensureDirectoryExists(goalsDir);

      const filePath = this.getGoalFilePath(goal.id);
      const data = goal.toDict();
      const yamlContent = YAML.stringify(data);
      await this.fileSystem.writeFile(filePath, yamlContent);
      goal.file_path = filePath;
    } catch (error) {
      throw new Error(`Failed to save goal "${goal.title}": ${error}`);
    }
  }

  async deleteGoal(goalId: GoalId): Promise<boolean> {
    try {
      const filePath = this.getGoalFilePath(goalId);
      return await this.fileSystem.deleteFile(filePath);
    } catch (error) {
      console.error(`Failed to delete goal ${goalId}:`, error);
      return false;
    }
  }

  private getGoalFilePath(goalId: GoalId): string {
    const safeId = getSafeFilename(goalId);
    return `${this.fileSystem.getGoalsDirectory()}${safeId}.yml`;
  }

  private async loadGoalFromFile(filePath: string): Promise<Goal | null> {
    try {
      const content = await this.fileSystem.readFile(filePath);
      const data = YAML.parse(content);
      return Goal.fromDict({ ...data, file_path: filePath });
    } catch (error) {
      console.error(`Failed to parse goal from ${filePath}:`, error);
      return null;
    }
  }
}
