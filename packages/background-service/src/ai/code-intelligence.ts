import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import fs from 'fs';
import path from 'path';

const log = getLogger();

interface CodeEntity {
  type: 'function' | 'class' | 'method' | 'variable' | 'import' | 'interface' | 'type' | 'enum';
  name: string;
  filePath: string;
  line: number;
  column: number;
  endLine?: number;
  signature?: string;
  docstring?: string;
  parent?: string;
}

interface CodeAnalysis {
  filePath: string;
  language: string;
  entities: CodeEntity[];
  imports: string[];
  exports: string[];
  complexity: number;
  linesOfCode: number;
}

export class CodeIntelligence {
  private languagePatterns: Record<string, {
    extensions: string[];
    functionPattern: RegExp;
    classPattern: RegExp;
    importPattern: RegExp;
    exportPattern: RegExp;
    commentPattern: RegExp;
  }>;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.initializePatterns();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        name TEXT NOT NULL,
        signature TEXT,
        line_number INTEGER,
        end_line INTEGER,
        parent_name TEXT,
        language TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS code_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        language TEXT NOT NULL,
        lines_of_code INTEGER DEFAULT 0,
        complexity INTEGER DEFAULT 0,
        last_analyzed TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_entities_file ON code_entities(file_path);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON code_entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON code_entities(name);
      CREATE INDEX IF NOT EXISTS idx_files_lang ON code_files(language);
    `);
  }

  private initializePatterns(): void {
    this.languagePatterns = {
      typescript: {
        extensions: ['.ts', '.tsx'],
        functionPattern: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
        classPattern: /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+\w+)?/g,
        importPattern: /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g,
        exportPattern: /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g,
        commentPattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
      },
      javascript: {
        extensions: ['.js', '.jsx'],
        functionPattern: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
        classPattern: /(?:export\s+)?class\s+(\w+)/g,
        importPattern: /(?:import|require)\s*(?:{[^}]+}|\w+)\s*(?:from\s+)?['"]([^'"]+)['"]/g,
        exportPattern: /(?:module\.exports|exports)\s*=\s*{([^}]+)}/g,
        commentPattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
      },
      python: {
        extensions: ['.py'],
        functionPattern: /(?:def|async\s+def)\s+(\w+)\s*\([^)]*\)/g,
        classPattern: /class\s+(\w+)(?:\s*\([^)]*\))?/g,
        importPattern: /(?:from\s+(\S+)\s+)?import\s+(\w+(?:,\s*\w+)*)/g,
        exportPattern: /(?:__all__\s*=\s*\[([^\]]+)\])/g,
        commentPattern: /#.*$|"""[\s\S]*?"""|'''[\s\S]*?'''/gm,
      },
    };
  }

  async analyzeFile(filePath: string): Promise<CodeAnalysis | null> {
    const ext = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(ext);

    if (!language) return null;

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const entities = this.extractEntities(content, language, filePath);
      const imports = this.extractImports(content, language);
      const exports = this.extractExports(content, language);
      const complexity = this.calculateComplexity(content, language);

      const analysis: CodeAnalysis = {
        filePath,
        language,
        entities,
        imports,
        exports,
        complexity,
        linesOfCode: lines.length,
      };

      await this.storeAnalysis(analysis);

      this.bus.emit('CODE_ANALYZED', 'code-intelligence', {
        filePath,
        language,
        entityCount: entities.length,
        linesOfCode: lines.length,
      });

      log.debug({ filePath, language, entities: entities.length }, 'File analyzed');
      return analysis;
    } catch (err) {
      log.debug({ err, filePath }, 'Failed to analyze file');
      return null;
    }
  }

  private detectLanguage(ext: string): string | null {
    for (const [lang, config] of Object.entries(this.languagePatterns)) {
      if (config.extensions.includes(ext)) return lang;
    }
    return null;
  }

  private extractEntities(content: string, language: string, filePath: string): CodeEntity[] {
    const entities: CodeEntity[] = [];
    const lines = content.split('\n');
    const patterns = this.languagePatterns[language];

    if (!patterns) return entities;

    // Extract functions
    const funcRegex = new RegExp(patterns.functionPattern.source, 'g');
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      entities.push({
        type: 'function',
        name: match[1],
        filePath,
        line: lineNum,
        column: match.index - content.lastIndexOf('\n', match.index) - 1,
        signature: match[0],
      });
    }

    // Extract classes
    const classRegex = new RegExp(patterns.classPattern.source, 'g');
    while ((match = classRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      entities.push({
        type: 'class',
        name: match[1],
        filePath,
        line: lineNum,
        column: match.index - content.lastIndexOf('\n', match.index) - 1,
      });
    }

    return entities;
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];
    const patterns = this.languagePatterns[language];

    if (!patterns) return imports;

    const importRegex = new RegExp(patterns.importPattern.source, 'g');
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath) imports.push(importPath);
    }

    return [...new Set(imports)];
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];
    const patterns = this.languagePatterns[language];

    if (!patterns) return exports;

    const exportRegex = new RegExp(patterns.exportPattern.source, 'g');
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }

    return [...new Set(exports)];
  }

  private calculateComplexity(content: string, language: string): number {
    let complexity = 1;

    const patterns = [
      /\bif\b/g, /\belse\b/g, /\bfor\b/g, /\bwhile\b/g,
      /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g, /\btry\b/g,
      /\b\?\b/g, /&&/g, /\|\|/g,
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) complexity += matches.length;
    }

    return Math.min(100, complexity);
  }

  private async storeAnalysis(analysis: CodeAnalysis): Promise<void> {
    const existing = this.db.prepare('SELECT id FROM code_files WHERE file_path = ?').get(analysis.filePath) as { id: number } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE code_files SET language = ?, lines_of_code = ?, complexity = ?, last_analyzed = datetime('now')
        WHERE file_path = ?
      `).run(analysis.language, analysis.linesOfCode, analysis.complexity, analysis.filePath);
    } else {
      this.db.prepare(`
        INSERT INTO code_files (file_path, language, lines_of_code, complexity, last_analyzed)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(analysis.filePath, analysis.language, analysis.linesOfCode, analysis.complexity);
    }

    this.db.prepare('DELETE FROM code_entities WHERE file_path = ?').run(analysis.filePath);

    for (const entity of analysis.entities) {
      this.db.prepare(`
        INSERT INTO code_entities (file_path, entity_type, name, signature, line_number, parent_name, language)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(entity.filePath, entity.type, entity.name, entity.signature || null, entity.line, entity.parent || null, analysis.language);
    }
  }

  async searchCode(query: string, limit = 20): Promise<CodeEntity[]> {
    return this.db.prepare(`
      SELECT * FROM code_entities
      WHERE name LIKE ? OR signature LIKE ?
      ORDER BY name LIMIT ?
    `).all(`%${query}%`, `%${query}%`, limit) as CodeEntity[];
  }

  async getFileAnalysis(filePath: string): Promise<CodeAnalysis | null> {
    const file = this.db.prepare('SELECT * FROM code_files WHERE file_path = ?').get(filePath) as any;
    if (!file) return null;

    const entities = this.db.prepare('SELECT * FROM code_entities WHERE file_path = ?').all(filePath) as CodeEntity[];

    return {
      filePath: file.file_path,
      language: file.language,
      entities,
      imports: [],
      exports: [],
      complexity: file.complexity,
      linesOfCode: file.lines_of_code,
    };
  }

  async getLanguageStats(): Promise<Array<{ language: string; files: number; lines: number }>> {
    return this.db.prepare(`
      SELECT language, COUNT(*) as files, SUM(lines_of_code) as lines
      FROM code_files
      GROUP BY language
      ORDER BY files DESC
    `).all() as any[];
  }

  async getTopEntities(type?: string, limit = 20): Promise<CodeEntity[]> {
    let query = 'SELECT * FROM code_entities';
    const params: unknown[] = [];

    if (type) {
      query += ' WHERE entity_type = ?';
      params.push(type);
    }

    query += ' ORDER BY name LIMIT ?';
    params.push(limit);

    return this.db.prepare(query).all(...params) as CodeEntity[];
  }
}
