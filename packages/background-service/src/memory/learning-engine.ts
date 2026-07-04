import { Database, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';
import { EmbeddingGenerator } from '../ai/embedding-generator.js';
import { getConfig } from '@ai-work-memory/shared';

const log = getLogger();

interface ProjectInfo {
  name: string;
  path: string;
  technologies: string[];
  firstSeen: string;
  lastSeen: string;
}

interface KnowledgeNode {
  id: number;
  type: string;
  name: string;
  metadata: string | null;
}

interface KnowledgeEdge {
  id: number;
  sourceId: number;
  targetId: number;
  relationship: string;
  weight: number;
}

export class LearningEngine {
  private ollama: OllamaClient;
  private embeddingGenerator: EmbeddingGenerator;

  constructor(private db: Database) {
    this.ollama = new OllamaClient();
    this.embeddingGenerator = new EmbeddingGenerator();
  }

  async start(): Promise<void> {
    log.info('Learning engine started');
  }

  async detectProject(appName: string, windowTitle: string, filePath?: string): Promise<string | null> {
    if (filePath) {
      const project = this.findProjectByPath(filePath);
      if (project) return project;
    }

    const project = this.findProjectByTitle(windowTitle);
    if (project) return project;

    const projectFromApp = this.findProjectByApp(appName);
    if (projectFromApp) return projectFromApp;

    return null;
  }

  private findProjectByPath(filePath: string): string | null {
    const stmt = this.db.prepare(
      `SELECT name FROM projects WHERE path IS NOT NULL AND ? LIKE path || '%'`
    );
    const row = stmt.get(filePath) as { name: string } | undefined;
    return row?.name ?? null;
  }

  private findProjectByTitle(title: string): string | null {
    const stmt = this.db.prepare(
      `SELECT name FROM projects`
    );
    const projects = stmt.all() as Array<{ name: string }>;

    for (const project of projects) {
      if (title.toLowerCase().includes(project.name.toLowerCase())) {
        return project.name;
      }
    }

    return null;
  }

  private findProjectByApp(appName: string): string | null {
    const stmt = this.db.prepare(
      `SELECT DISTINCT p.name FROM projects p
       JOIN sessions s ON s.project_id = p.id
       WHERE s.app_name = ?`
    );
    const row = stmt.get(appName) as { name: string } | undefined;
    return row?.name ?? null;
  }

  async learnProjectStructure(projectName: string): Promise<{
    technologies: string[];
    files: string[];
    structure: Record<string, unknown>;
  }> {
    const stmt = this.db.prepare(
      `SELECT DISTINCT file_path FROM project_files
       WHERE project_id = (SELECT id FROM projects WHERE name = ?)`
    );
    const files = stmt.all(projectName) as Array<{ file_path: string }>;

    const technologies = this.detectTechnologies(files.map((f) => f.file_path));

    return {
      technologies,
      files: files.map((f) => f.file_path),
      structure: this.buildStructure(files.map((f) => f.file_path)),
    };
  }

  private detectTechnologies(filePaths: string[]): string[] {
    const techMap: Record<string, string[]> = {
      '.js': ['JavaScript'],
      '.ts': ['TypeScript'],
      '.tsx': ['React', 'TypeScript'],
      '.jsx': ['React', 'JavaScript'],
      '.vue': ['Vue.js'],
      '.py': ['Python'],
      '.rs': ['Rust'],
      '.go': ['Go'],
      '.java': ['Java'],
      '.php': ['PHP'],
      '.rb': ['Ruby'],
      '.css': ['CSS'],
      '.scss': ['SCSS'],
      '.html': ['HTML'],
      '.json': ['JSON'],
      '.yaml': ['YAML'],
      '.yml': ['YAML'],
      '.sql': ['SQL'],
      '.sh': ['Shell'],
      '.dockerfile': ['Docker'],
    };

    const techs = new Set<string>();

    for (const filePath of filePaths) {
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const filename = filePath.split(/[/\\]/).pop()?.toLowerCase() || '';

      if (filename === 'dockerfile') {
        techs.add('Docker');
      } else if (filename === 'package.json') {
        techs.add('Node.js');
      } else if (filename === 'requirements.txt') {
        techs.add('Python');
      } else if (filename === 'cargo.toml') {
        techs.add('Rust');
      } else if (filename === 'go.mod') {
        techs.add('Go');
      } else if (filename === 'pom.xml') {
        techs.add('Java');
      } else if (techMap[ext]) {
        techMap[ext].forEach((t) => techs.add(t));
      }
    }

    return Array.from(techs);
  }

  private buildStructure(filePaths: string[]): Record<string, unknown> {
    const structure: Record<string, unknown> = {};

    for (const filePath of filePaths) {
      const parts = filePath.split(/[/\\]/);
      let current = structure;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }

      current[parts[parts.length - 1]] = null;
    }

    return structure;
  }

  async updateKnowledgeGraph(): Promise<void> {
    try {
      log.info('Starting knowledge graph update...');

      await this.updateProjectAppRelationships();
      await this.updateProjectTechnologyRelationships();
      await this.updateAppCoOccurrence();
      await this.updateProjectFileRelationships();

      const nodeCount = (this.db.prepare('SELECT COUNT(*) as count FROM knowledge_nodes').get() as { count: number }).count;
      const edgeCount = (this.db.prepare('SELECT COUNT(*) as count FROM knowledge_edges').get() as { count: number }).count;

      log.info({ nodeCount, edgeCount }, 'Knowledge graph updated successfully');
    } catch (err) {
      log.warn({ err }, 'Failed to update knowledge graph');
    }
  }

  private async updateProjectAppRelationships(): Promise<void> {
    const stmt = this.db.prepare(
      `SELECT p.id as project_id, p.name as project_name, s.app_name, COUNT(*) as count
       FROM sessions s
       JOIN projects p ON s.project_id = p.id
       WHERE p.id IS NOT NULL
       GROUP BY p.id, s.app_name
       HAVING count > 2`
    );
    const rows = stmt.all() as Array<{
      project_id: number;
      project_name: string;
      app_name: string;
      count: number;
    }>;

    for (const row of rows) {
      const projectNode = this.getOrCreateNode('project', row.project_name);
      const appNode = this.getOrCreateNode('app', row.app_name);
      this.createEdge(projectNode.id, appNode.id, 'uses_app', Math.min(row.count / 10, 1.0));
    }
  }

  private async updateProjectTechnologyRelationships(): Promise<void> {
    const stmt = this.db.prepare(
      `SELECT p.id as project_id, p.name as project_name, p.technologies
       FROM projects p
       WHERE p.technologies IS NOT NULL`
    );
    const rows = stmt.all() as Array<{
      project_id: number;
      project_name: string;
      technologies: string;
    }>;

    for (const row of rows) {
      try {
        const techs = JSON.parse(row.technologies) as string[];
        const projectNode = this.getOrCreateNode('project', row.project_name);

        for (const tech of techs) {
          const techNode = this.getOrCreateNode('technology', tech);
          this.createEdge(projectNode.id, techNode.id, 'uses_tech', 1.0);
        }
      } catch {}
    }
  }

  private async updateAppCoOccurrence(): Promise<void> {
    const stmt = this.db.prepare(
      `SELECT s1.app_name as app1, s2.app_name as app2, COUNT(*) as count
       FROM sessions s1
       JOIN sessions s2 ON s1.id < s2.id
       AND abs(julianday(s1.start_time) - julianday(s2.start_time)) < 0.02
       WHERE s1.app_name != s2.app_name
       GROUP BY s1.app_name, s2.app_name
       HAVING count > 3
       ORDER BY count DESC
       LIMIT 50`
    );
    const rows = stmt.all() as Array<{
      app1: string;
      app2: string;
      count: number;
    }>;

    for (const row of rows) {
      const node1 = this.getOrCreateNode('app', row.app1);
      const node2 = this.getOrCreateNode('app', row.app2);
      this.createEdge(node1.id, node2.id, 'co_occurs', Math.min(row.count / 20, 1.0));
    }
  }

  private async updateProjectFileRelationships(): Promise<void> {
    const stmt = this.db.prepare(
      `SELECT p.name as project_name, pf.file_path
       FROM project_files pf
       JOIN projects p ON pf.project_id = p.id
       WHERE pf.file_path IS NOT NULL`
    );
    const rows = stmt.all() as Array<{
      project_name: string;
      file_path: string;
    }>;

    for (const row of rows) {
      const projectNode = this.getOrCreateNode('project', row.project_name);
      const fileName = row.file_path.split(/[/\\]/).pop() || row.file_path;
      const fileNode = this.getOrCreateNode('file', fileName);
      this.createEdge(projectNode.id, fileNode.id, 'contains_file', 0.5);
    }
  }

  private getOrCreateNode(type: string, name: string): KnowledgeNode {
    const existing = this.db.prepare(
      'SELECT id, type, name, metadata FROM knowledge_nodes WHERE type = ? AND name = ?'
    ).get(type, name) as KnowledgeNode | undefined;

    if (existing) {
      return existing;
    }

    const result = this.db.prepare(
      'INSERT INTO knowledge_nodes (type, name) VALUES (?, ?)'
    ).run(type, name);

    return {
      id: result.lastInsertRowid as number,
      type,
      name,
      metadata: null,
    };
  }

  private createEdge(sourceId: number, targetId: number, relationship: string, weight: number): void {
    const existing = this.db.prepare(
      'SELECT id FROM knowledge_edges WHERE source_id = ? AND target_id = ? AND relationship = ?'
    ).get(sourceId, targetId, relationship) as { id: number } | undefined;

    if (existing) {
      this.db.prepare(
        'UPDATE knowledge_edges SET weight = ? WHERE id = ?'
      ).run(weight, existing.id);
    } else {
      this.db.prepare(
        'INSERT INTO knowledge_edges (source_id, target_id, relationship, weight) VALUES (?, ?, ?, ?)'
      ).run(sourceId, targetId, relationship, weight);
    }
  }

  async getRelatedNodes(nodeId: number, depth: number = 2): Promise<Array<{ node: KnowledgeNode; relationship: string; depth: number }>> {
    const results: Array<{ node: KnowledgeNode; relationship: string; depth: number }> = [];
    const visited = new Set<number>();

    const traverse = async (currentId: number, currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentId)) return;
      visited.add(currentId);

      const edges = this.db.prepare(
        `SELECT e.relationship, 
                CASE WHEN e.source_id = ? THEN e.target_id ELSE e.source_id END as related_id
         FROM knowledge_edges e
         WHERE e.source_id = ? OR e.target_id = ?`
      ).all(currentId, currentId, currentId) as Array<{ relationship: string; related_id: number }>;

      for (const edge of edges) {
        const node = this.db.prepare(
          'SELECT id, type, name, metadata FROM knowledge_nodes WHERE id = ?'
        ).get(edge.related_id) as KnowledgeNode | undefined;

        if (node) {
          results.push({ node, relationship: edge.relationship, depth: currentDepth });
          await traverse(edge.related_id, currentDepth + 1);
        }
      }
    };

    await traverse(nodeId, 1);
    return results;
  }

  async getProjectGraph(projectName: string): Promise<{
    project: KnowledgeNode | null;
    technologies: string[];
    apps: string[];
    files: string[];
    relatedProjects: string[];
  }> {
    const project = this.db.prepare(
      'SELECT id, type, name, metadata FROM knowledge_nodes WHERE type = ? AND name = ?'
    ).get('project', projectName) as KnowledgeNode | undefined;

    if (!project) {
      return { project: null, technologies: [], apps: [], files: [], relatedProjects: [] };
    }

    const technologies = this.db.prepare(
      `SELECT n.name FROM knowledge_edges e
       JOIN knowledge_nodes n ON (e.target_id = n.id OR e.source_id = n.id)
       WHERE (e.source_id = ? OR e.target_id = ?) AND e.relationship = 'uses_tech'
       AND n.type = 'technology' AND n.id != ?`
    ).all(project.id, project.id, project.id).map((r: any) => r.name);

    const apps = this.db.prepare(
      `SELECT n.name FROM knowledge_edges e
       JOIN knowledge_nodes n ON (e.target_id = n.id OR e.source_id = n.id)
       WHERE (e.source_id = ? OR e.target_id = ?) AND e.relationship = 'uses_app'
       AND n.type = 'app' AND n.id != ?`
    ).all(project.id, project.id, project.id).map((r: any) => r.name);

    const files = this.db.prepare(
      `SELECT n.name FROM knowledge_edges e
       JOIN knowledge_nodes n ON (e.target_id = n.id OR e.source_id = n.id)
       WHERE (e.source_id = ? OR e.target_id = ?) AND e.relationship = 'contains_file'
       AND n.type = 'file' AND n.id != ?`
    ).all(project.id, project.id, project.id).map((r: any) => r.name);

    const relatedProjects = this.db.prepare(
      `SELECT DISTINCT n.name FROM knowledge_edges e1
       JOIN knowledge_edges e2 ON (e1.target_id = e2.source_id OR e1.target_id = e2.target_id
                                   OR e1.source_id = e2.source_id OR e1.source_id = e2.target_id)
       JOIN knowledge_nodes n ON (n.id = e2.source_id OR n.id = e2.target_id)
       WHERE (e1.source_id = ? OR e1.target_id = ?)
       AND n.type = 'project' AND n.id != ?`
    ).all(project.id, project.id, project.id).map((r: any) => r.name);

    return { project, technologies, apps, files, relatedProjects };
  }
}
