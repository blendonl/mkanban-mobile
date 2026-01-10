import { Timestamp, FilePath } from "../../core/types";
import { now } from "../../utils/dateUtils";
import { generateIdFromName } from "../../utils/stringUtils";

export type ProjectId = string;
export type ProjectStatus = 'active' | 'archived' | 'completed';

export interface ProjectProps {
  id?: ProjectId;
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  file_path?: FilePath | null;
}

export class Project {
  id: ProjectId;
  name: string;
  slug: string;
  description: string;
  color: string;
  status: ProjectStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
  file_path: FilePath | null;

  constructor(props: ProjectProps) {
    this.name = props.name;
    this.description = props.description || "";
    this.color = props.color || "#3B82F6";
    this.status = props.status || "active";
    this.created_at = props.created_at || now();
    this.updated_at = props.updated_at || now();
    this.file_path = props.file_path !== undefined ? props.file_path : null;

    if (props.slug) {
      this.slug = props.slug;
    } else {
      this.slug = this._generateSlug(props.name);
    }

    if (props.id) {
      this.id = props.id;
    } else if (this.file_path) {
      const pathParts = this.file_path.split("/");
      const dirName = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
      this.id = dirName;
    } else {
      this.id = this.slug;
    }
  }

  private _generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);
  }

  update(updates: Partial<ProjectProps>): void {
    const allowedFields = ["name", "description", "color", "status"];
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        (this as any)[key] = value;
      }
    });
    this.updated_at = now();
  }

  archive(): void {
    this.status = "archived";
    this.updated_at = now();
  }

  activate(): void {
    this.status = "active";
    this.updated_at = now();
  }

  complete(): void {
    this.status = "completed";
    this.updated_at = now();
  }

  get isActive(): boolean {
    return this.status === "active";
  }

  get isArchived(): boolean {
    return this.status === "archived";
  }

  toDict(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      color: this.color,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fromDict(data: Record<string, any>): Project {
    return new Project({
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      color: data.color,
      status: data.status,
      created_at: data.created_at ? new Date(data.created_at) : undefined,
      updated_at: data.updated_at ? new Date(data.updated_at) : undefined,
      file_path: data.file_path,
    });
  }
}
