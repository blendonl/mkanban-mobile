import matter from "gray-matter";
import * as YAML from 'yaml';
import { FileSystemManager } from "./FileSystemManager";
import { ProjectRepository } from "../../domain/repositories/ProjectRepository";
import { Project } from "../../domain/entities/Project";
import { ProjectId } from "../../core/types";
import { now } from "../../utils/dateUtils";

const PROJECT_FILENAME = 'project.md';

export class MarkdownProjectRepository implements ProjectRepository {
  private fileSystem: FileSystemManager;

  constructor(fileSystem: FileSystemManager) {
    this.fileSystem = fileSystem;
  }

  async loadAllProjects(): Promise<Project[]> {
    try {
      const projects: Project[] = [];
      const projectSlugs = await this.fileSystem.listProjects();

      for (const slug of projectSlugs) {
        const project = await this.loadProjectBySlug(slug);
        if (project) {
          projects.push(project);
        }
      }

      return projects;
    } catch (error) {
      console.error("Failed to load all projects:", error);
      return [];
    }
  }

  async loadProjectById(projectId: ProjectId): Promise<Project | null> {
    try {
      const projects = await this.loadAllProjects();
      return projects.find(p => p.id === projectId) || null;
    } catch (error) {
      console.error("Failed to load project by ID:", error);
      return null;
    }
  }

  async loadProjectBySlug(slug: string): Promise<Project | null> {
    try {
      const projectDir = this.fileSystem.getProjectDirectory(slug);
      const projectFile = `${projectDir}${PROJECT_FILENAME}`;

      const exists = await this.fileSystem.fileExists(projectFile);
      if (!exists) {
        return null;
      }

      const content = await this.fileSystem.readFile(projectFile);
      const parsed = matter(content);
      const data = parsed.data || {};

      return new Project({
        id: data.id || slug,
        name: data.name || slug,
        slug: data.slug || slug,
        description: data.description || "",
        color: data.color || "#3B82F6",
        status: data.status || "active",
        created_at: data.created_at ? new Date(data.created_at) : now(),
        updated_at: data.updated_at ? new Date(data.updated_at) : now(),
        file_path: projectFile,
      });
    } catch (error) {
      console.error(`Failed to load project by slug ${slug}:`, error);
      return null;
    }
  }

  async saveProject(project: Project): Promise<void> {
    try {
      await this.fileSystem.createProjectStructure(project.slug);

      const projectDir = this.fileSystem.getProjectDirectory(project.slug);
      const projectFile = `${projectDir}${PROJECT_FILENAME}`;

      const data = {
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        color: project.color,
        status: project.status,
        created_at: project.created_at instanceof Date
          ? project.created_at.toISOString()
          : project.created_at,
        updated_at: project.updated_at instanceof Date
          ? project.updated_at.toISOString()
          : project.updated_at,
      };

      const yamlContent = YAML.stringify(data);
      const fileContent = `---\n${yamlContent}---\n\n# ${project.name}\n`;
      await this.fileSystem.writeFile(projectFile, fileContent);
    } catch (error) {
      throw new Error(`Failed to save project "${project.name}": ${error}`);
    }
  }

  async deleteProject(projectId: ProjectId): Promise<boolean> {
    try {
      const project = await this.loadProjectById(projectId);
      if (!project) {
        return false;
      }

      const projectDir = this.fileSystem.getProjectDirectory(project.slug);
      return await this.fileSystem.deleteDirectory(projectDir);
    } catch (error) {
      console.error("Failed to delete project:", error);
      return false;
    }
  }

  async listProjectSlugs(): Promise<string[]> {
    return await this.fileSystem.listProjects();
  }

  getProjectBoardsDirectory(project: Project): string {
    return this.fileSystem.getProjectBoardsDirectory(project.slug);
  }

  getProjectNotesDirectory(project: Project): string {
    return this.fileSystem.getProjectNotesDirectory(project.slug);
  }

  getProjectTimeDirectory(project: Project): string {
    return this.fileSystem.getProjectTimeDirectory(project.slug);
  }

  async createProjectWithDefaults(name: string, description?: string): Promise<Project> {
    const project = new Project({
      name,
      description: description || "",
    });

    await this.saveProject(project);
    return project;
  }
}
