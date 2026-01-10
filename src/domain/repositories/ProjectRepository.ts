import { Project } from "../entities/Project";
import { ProjectId } from "../../core/types";

export interface ProjectRepository {
  loadAllProjects(): Promise<Project[]>;

  loadProjectById(projectId: ProjectId): Promise<Project | null>;

  loadProjectBySlug(slug: string): Promise<Project | null>;

  saveProject(project: Project): Promise<void>;

  deleteProject(projectId: ProjectId): Promise<boolean>;

  listProjectSlugs(): Promise<string[]>;

  getProjectBoardsDirectory(project: Project): string;

  getProjectNotesDirectory(project: Project): string;

  getProjectTimeDirectory(project: Project): string;

  createProjectWithDefaults(name: string, description?: string): Promise<Project>;
}
