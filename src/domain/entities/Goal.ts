import { GoalId, ProjectId, Timestamp, FilePath } from "../../core/types";
import { now } from "../../utils/dateUtils";
import { generateIdFromName } from "../../utils/stringUtils";

export type GoalStatus = 'active' | 'completed' | 'archived';

export interface GoalProps {
  id?: GoalId;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  project_ids?: ProjectId[];
  status?: GoalStatus;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  file_path?: FilePath | null;
  target_value?: number | null;
  value_unit?: string | null;
  current_value?: number;
}

export class Goal {
  id: GoalId;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  project_ids: ProjectId[];
  status: GoalStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
  file_path: FilePath | null;
  target_value: number | null;
  value_unit: string | null;
  current_value: number;

  constructor(props: GoalProps) {
    this.title = props.title;
    this.description = props.description || "";
    this.start_date = props.start_date;
    this.end_date = props.end_date;
    this.project_ids = props.project_ids || [];
    this.status = props.status || "active";
    this.created_at = props.created_at || now();
    this.updated_at = props.updated_at || now();
    this.file_path = props.file_path !== undefined ? props.file_path : null;
    this.target_value = props.target_value !== undefined ? props.target_value : null;
    this.value_unit = props.value_unit !== undefined ? props.value_unit : null;
    this.current_value = props.current_value || 0;

    if (props.id) {
      this.id = props.id;
    } else {
      this.id = generateIdFromName(this.title) || `goal-${Date.now()}`;
    }
  }

  update(updates: Partial<GoalProps>): void {
    const allowedFields = ["title", "description", "start_date", "end_date", "project_ids", "status"];
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        (this as any)[key] = value;
      }
    });
    this.updated_at = now();
  }

  complete(): void {
    this.status = "completed";
    this.updated_at = now();
  }

  archive(): void {
    this.status = "archived";
    this.updated_at = now();
  }

  updateProgress(additionalValue: number): void {
    this.current_value += additionalValue;
    this.updated_at = now();
  }

  setProgress(value: number): void {
    this.current_value = value;
    this.updated_at = now();
  }

  get progressPercentage(): number {
    if (!this.target_value || this.target_value === 0) return 0;
    return Math.min(100, (this.current_value / this.target_value) * 100);
  }

  toDict(): Record<string, any> {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      start_date: this.start_date,
      end_date: this.end_date,
      project_ids: this.project_ids,
      status: this.status,
      created_at: this.created_at instanceof Date ? this.created_at.toISOString() : this.created_at,
      updated_at: this.updated_at instanceof Date ? this.updated_at.toISOString() : this.updated_at,
      target_value: this.target_value,
      value_unit: this.value_unit,
      current_value: this.current_value,
    };
  }

  static fromDict(data: Record<string, any>): Goal {
    return new Goal({
      id: data.id,
      title: data.title,
      description: data.description,
      start_date: data.start_date,
      end_date: data.end_date,
      project_ids: data.project_ids || [],
      status: data.status,
      created_at: data.created_at ? new Date(data.created_at) : undefined,
      updated_at: data.updated_at ? new Date(data.updated_at) : undefined,
      file_path: data.file_path,
      target_value: data.target_value || null,
      value_unit: data.value_unit || null,
      current_value: data.current_value || 0,
    });
  }
}
