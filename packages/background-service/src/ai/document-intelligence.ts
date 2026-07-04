import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const log = getLogger();

interface DocumentInfo {
  id: number;
  filePath: string;
  fileName: string;
  fileType: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  entities: string[];
  topics: string[];
  createdAt: string;
}

export class DocumentIntelligence {
  private watchDirs: string[] = [];

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupWatchDirs();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        title TEXT,
        content TEXT,
        metadata TEXT DEFAULT '{}',
        entities TEXT DEFAULT '[]',
        topics TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding_id TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
      );

      CREATE INDEX IF NOT EXISTS idx_docs_path ON documents(file_path);
      CREATE INDEX IF NOT EXISTS idx_docs_type ON documents(file_type);
      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
    `);
  }

  private setupWatchDirs(): void {
    const home = os.homedir();
    this.watchDirs = [
      path.join(home, 'Documents'),
      path.join(home, 'Desktop'),
      path.join(home, 'Downloads'),
    ];
  }

  async processDocument(filePath: string): Promise<DocumentInfo | null> {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    const supportedTypes = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.txt', '.md'];
    if (!supportedTypes.includes(ext)) {
      return null;
    }

    try {
      const content = await this.extractContent(filePath, ext);
      const title = this.extractTitle(content, fileName);
      const entities = this.extractEntities(content);
      const topics = this.extractTopics(content);

      const existing = this.db.prepare('SELECT id FROM documents WHERE file_path = ?').get(filePath) as { id: number } | undefined;

      let docId: number;
      if (existing) {
        this.db.prepare(`
          UPDATE documents SET content = ?, title = ?, entities = ?, topics = ?, updated_at = datetime('now')
          WHERE file_path = ?
        `).run(content, title, JSON.stringify(entities), JSON.stringify(topics), filePath);
        docId = existing.id;
      } else {
        const result = this.db.prepare(`
          INSERT INTO documents (file_path, file_name, file_type, title, content, entities, topics)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(filePath, fileName, ext, title, content, JSON.stringify(entities), JSON.stringify(topics));
        docId = result.lastInsertRowid as number;
      }

      await this.createChunks(docId, content);

      const doc: DocumentInfo = {
        id: docId,
        filePath,
        fileName,
        fileType: ext,
        title,
        content: content.substring(0, 1000),
        metadata: {},
        entities,
        topics,
        createdAt: new Date().toISOString(),
      };

      this.bus.emit('DOCUMENT_PROCESSED', 'document-intelligence', {
        documentId: docId,
        fileName,
        fileType: ext,
        title,
        entities,
        topics,
      });

      log.info({ fileName, fileType: ext, entities: entities.length }, 'Document processed');
      return doc;
    } catch (err) {
      log.warn({ err, filePath }, 'Failed to process document');
      return null;
    }
  }

  private async extractContent(filePath: string, ext: string): Promise<string> {
    switch (ext) {
      case '.txt':
      case '.md':
        return await fs.promises.readFile(filePath, 'utf-8');
      case '.pdf':
        return await this.extractPdf(filePath);
      case '.docx':
      case '.doc':
        return await this.extractDocx(filePath);
      case '.pptx':
      case '.ppt':
        return await this.extractPptx(filePath);
      case '.xlsx':
      case '.xls':
        return await this.extractXlsx(filePath);
      default:
        return '';
    }
  }

  private async extractPdf(filePath: string): Promise<string> {
    try {
      const script = `
import sys
try:
    import fitz
    doc = fitz.open('${filePath.replace(/\\/g, '\\\\')}')
    text = ""
    for page in doc:
        text += page.get_text()
    print(text[:50000])
except Exception as e:
    print("")
`;
      return await this.execPython(script);
    } catch {
      return '';
    }
  }

  private async extractDocx(filePath: string): Promise<string> {
    try {
      const script = `
import sys
try:
    from docx import Document
    doc = Document('${filePath.replace(/\\/g, '\\\\')}')
    text = "\\n".join([p.text for p in doc.paragraphs])
    print(text[:50000])
except Exception as e:
    print("")
`;
      return await this.execPython(script);
    } catch {
      return '';
    }
  }

  private async extractPptx(filePath: string): Promise<string> {
    try {
      const script = `
import sys
try:
    from pptx import Presentation
    prs = Presentation('${filePath.replace(/\\/g, '\\\\')}')
    text = ""
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                text += shape.text + "\\n"
    print(text[:50000])
except Exception as e:
    print("")
`;
      return await this.execPython(script);
    } catch {
      return '';
    }
  }

  private async extractXlsx(filePath: string): Promise<string> {
    try {
      const script = `
import sys
try:
    import openpyxl
    wb = openpyxl.load_workbook('${filePath.replace(/\\/g, '\\\\')}', read_only=True)
    text = ""
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        for row in ws.iter_rows(max_row=100, values_only=True):
            text += "\\t".join([str(c) if c else "" for c in row]) + "\\n"
    print(text[:50000])
except Exception as e:
    print("")
`;
      return await this.execPython(script);
    } catch {
      return '';
    }
  }

  private extractTitle(content: string, fileName: string): string {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 0 && lines[0].length < 200) {
      return lines[0].trim();
    }
    return path.parse(fileName).name;
  }

  private extractEntities(content: string): string[] {
    const entities = new Set<string>();

    const patterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
      /\b(?:Project|Repo|Module|Component|Service|API)\s*[:=]\s*(\w+)/gi,
      /\b(?:function|class|interface|type)\s+(\w+)/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const entity = match[1] || match[0];
        if (entity.length > 2 && entity.length < 50) {
          entities.add(entity);
        }
      }
    }

    return Array.from(entities).slice(0, 20);
  }

  private extractTopics(content: string): string[] {
    const topics = new Set<string>();
    const lower = content.toLowerCase();

    const topicPatterns = [
      { pattern: /\b(auth|oauth|jwt|login|signup)\b/i, topic: 'Authentication' },
      { pattern: /\b(api|endpoint|rest|graphql)\b/i, topic: 'API' },
      { pattern: /\b(database|sql|sqlite|postgres|mongo)\b/i, topic: 'Database' },
      { pattern: /\b(ui|ux|design|figma|css)\b/i, topic: 'Design' },
      { pattern: /\b(test|testing|jest|mocha|cypress)\b/i, topic: 'Testing' },
      { pattern: /\b(deploy|ci|cd|docker|kubernetes)\b/i, topic: 'DevOps' },
      { pattern: /\b(security|vulnerability|xss|csrf)\b/i, topic: 'Security' },
      { pattern: /\b(performance|optimization|cache)\b/i, topic: 'Performance' },
    ];

    for (const { pattern, topic } of topicPatterns) {
      if (pattern.test(content)) {
        topics.add(topic);
      }
    }

    return Array.from(topics);
  }

  private async createChunks(docId: number, content: string): Promise<void> {
    const chunkSize = 500;
    const overlap = 50;
    const chunks: string[] = [];

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      chunks.push(content.substring(i, i + chunkSize));
    }

    this.db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(docId);

    for (let i = 0; i < chunks.length; i++) {
      this.db.prepare(`
        INSERT INTO document_chunks (document_id, chunk_index, content)
        VALUES (?, ?, ?)
      `).run(docId, i, chunks[i]);
    }
  }

  async searchDocuments(query: string, limit = 10): Promise<DocumentInfo[]> {
    const docs = this.db.prepare(`
      SELECT * FROM documents
      WHERE content LIKE ? OR title LIKE ? OR entities LIKE ? OR topics LIKE ?
      ORDER BY updated_at DESC LIMIT ?
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit) as any[];

    return docs.map(d => ({
      ...d,
      metadata: JSON.parse(d.metadata || '{}'),
      entities: JSON.parse(d.entities || '[]'),
      topics: JSON.parse(d.topics || '[]'),
    }));
  }

  async getDocuments(limit = 50): Promise<DocumentInfo[]> {
    const docs = this.db.prepare(`
      SELECT * FROM documents ORDER BY updated_at DESC LIMIT ?
    `).all(limit) as any[];

    return docs.map(d => ({
      ...d,
      metadata: JSON.parse(d.metadata || '{}'),
      entities: JSON.parse(d.entities || '[]'),
      topics: JSON.parse(d.topics || '[]'),
    }));
  }

  private execPython(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptFile = path.join(os.tmpdir(), `rewindx-doc-${Date.now()}.py`);
      fs.writeFileSync(scriptFile, script, 'utf-8');

      execFile('python', [scriptFile], { timeout: 30000, windowsHide: true }, (err, stdout) => {
        try { fs.unlinkSync(scriptFile); } catch {}
        if (err) {
          reject(err);
          return;
        }
        resolve(stdout || '');
      });
    });
  }
}
