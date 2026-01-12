/**
 * Column entity for organizing tasks in a kanban board
 * Ported from Python: src/domain/entities/column.py
 */

import { ColumnId, ParentId, Timestamp, FilePath } from "../../core/types";
import { now } from "../../utils/dateUtils";
import { generateIdFromName } from "../../utils/stringUtils";
import { Task } from "./Task";

export interface ColumnProps {
  id?: ColumnId;
  name: string;
  position?: number;
  limit?: number | null;
  created_at?: Timestamp;
  tasks?: Task[];
  file_path?: FilePath | null;
}

export class Column {
  id: ColumnId;
  name: string;
  position: number;
  limit: number | null;
  created_at: Timestamp;
  tasks: Task[];
  file_path: FilePath | null;

  constructor(props: ColumnProps) {
    this.name = props.name;
    this.position = props.position || 0;
    this.limit = props.limit !== undefined ? props.limit : null;
    this.created_at = props.created_at || now();
    this.tasks = props.tasks || [];
    this.file_path = props.file_path !== undefined ? props.file_path : null;

    // Auto-generate ID if not provided
    if (props.id) {
      this.id = props.id;
    } else if (this.file_path) {
      // Extract ID from file path (directory name)
      const pathParts = this.file_path.split("/");
      const dirName = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
      this.id = dirName;
      if (!this.name || this.name === dirName) {
        this.name = dirName.replace(/-/g, " ").replace(/_/g, " ");
        this.name = this.name
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
    } else {
      this.id = generateIdFromName(this.name) || "unnamed_column";
    }
  }

  /**
   * Update column properties
   */
  update(updates: Partial<ColumnProps>): void {
    Object.assign(this, updates);
  }

  /**
   * Add a new task to the column
   */
  addTask(title: string, parentId?: ParentId | null, taskId?: string): Task {
    const task = new Task({
      id: taskId || "",
      title,
      parent_id: parentId,
      column_id: this.id,
    });
    this.tasks.push(task);
    return task;
  }

  /**
   * Move an existing task to the end of this column
   */
  moveTaskToEnd(task: Task): boolean {
    task.moveToColumn(this.id);
    this.tasks.push(task);
    return true;
  }

  /**
   * Remove a task from the column
   */
  removeTask(taskId: string): boolean {
    const originalCount = this.tasks.length;
    this.tasks = this.tasks.filter((task) => task.id !== taskId);
    return this.tasks.length < originalCount;
  }

  /**
   * Get all tasks in the column
   */
  getAllTasks(): Task[] {
    return this.tasks;
  }

  /**
   * Find a task by ID
   */
  getTaskById(taskId: string): Task | null {
    return this.tasks.find((task) => task.id === taskId) || null;
  }

  /**
   * Convert to plain object for serialization
   */
  toDict(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      position: this.position,
      limit: this.limit,
      created_at: this.created_at instanceof Date ? this.created_at.toISOString() : this.created_at,
    };
  }

  /**
   * Create Column from plain object (deserialization)
   */
  static fromDict(data: Record<string, any>): Column {
    return new Column({
      id: data.id,
      name: data.name,
      position: data.position,
      limit: data.limit,
      created_at: data.created_at ? new Date(data.created_at) : undefined,
      file_path: data.file_path,
    });
  }
}
