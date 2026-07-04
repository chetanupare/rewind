import { EventBus, Database, getLogger, getConfig } from '@ai-work-memory/shared';
import type { EventPayload, GitEvent } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

export class WikiGenerator {
  private ollama: OllamaClient;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.ollama = new OllamaClient();
  }

  async start(): Promise<void> {
    this.bus.on('GIT_COMMIT', this.handleGitCommit.bind(this));
    log.info('Wiki Generator started');
  }

  async stop(): Promise<void> {
    this.bus.removeAllListeners('GIT_COMMIT');
  }

  private async handleGitCommit(event: EventPayload): Promise<void> {
    try {
      const data = event.payload as unknown as GitEvent;
      if (!data.commitMessage) return;

      log.info({ repo: data.repoPath, msg: data.commitMessage }, 'Generating wiki entry for commit');

      // Fetch recent sessions and searches around this commit to provide context
      const sessionsStmt = this.db.prepare(
        `SELECT summary, app_name FROM sessions 
         WHERE datetime(start_time) > datetime('now', '-4 hours')`
      );
      const sessions = sessionsStmt.all() as Array<{ summary: string; app_name: string }>;
      
      let context = 'Recent sessions:\n';
      sessions.forEach(s => {
        context += `- ${s.app_name}: ${s.summary || 'Working'}\n`;
      });

      const prompt = `You are a technical documentation AI. A new commit was made to a repository:
Repo: ${data.repoPath || 'Unknown'}
Branch: ${data.branch || 'Unknown'}
Commit Message: ${data.commitMessage}

Context of what the user was doing:
${context}

Generate a concise, standalone wiki entry explaining the *why* and *how* of this change. Format as Markdown. Give it a descriptive Topic title on the first line.`;

      const cfg = getConfig().get();
      const result = await this.ollama.generate({ model: cfg.ai.textModel, prompt });

      // The first line is often the topic, let's extract it
      const lines = result.split('\\n').map(l => l.trim()).filter(Boolean);
      let topic = 'Auto-Documented Change';
      let content = result;
      
      if (lines[0].startsWith('# ')) {
        topic = lines[0].replace('# ', '').trim();
        content = lines.slice(1).join('\\n').trim();
      }

      const insertStmt = this.db.prepare(
        `INSERT INTO wiki (topic, content, repo_path, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      );
      insertStmt.run(topic, content, data.repoPath || null);

      log.info({ topic }, 'Saved new wiki entry');
      
      this.bus.emit('SYSTEM_RESOURCE_UPDATE', 'system-events', {
        action: 'WIKI_GENERATED',
        topic
      });
      
    } catch (err) {
      log.warn({ err }, 'Failed to generate wiki entry');
    }
  }
}
