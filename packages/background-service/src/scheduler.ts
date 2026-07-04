import cron from 'node-cron';
import { Database, EventBus, getLogger, getConfig } from '@ai-work-memory/shared';
import { OllamaClient } from './ai/ollama-client.js';
import fs from 'fs';

const log = getLogger();

export function startScheduler(db: Database, bus: EventBus): void {
  // Every 5 minutes — process unprocessed screenshots for OCR
  cron.schedule('*/5 * * * *', () => {
    processUnprocessedScreenshots(db, bus);
  });

  // Every 30 minutes — generate session summaries
  cron.schedule('*/30 * * * *', () => {
    generateSessionSummary(db);
  });

  // Every hour — rebuild timeline
  cron.schedule('0 * * * *', () => {
    rebuildTimeline(db);
  });

  // Every Friday at 5:00 PM — generate weekly report
  cron.schedule('0 17 * * 5', () => {
    generateWeeklyReport(db);
  });

  // Every weekday at 5:00 PM — generate daily standup
  cron.schedule('0 17 * * 1-5', () => {
    generateDailyStandup(db, bus);
  });

  // Every day at 11:59 PM — cleanup analyzed screenshots
  cron.schedule('59 23 * * *', () => {
    cleanupAnalyzedScreenshots(db);
  });

  log.info('Scheduler started');
}

async function generateWeeklyReport(db: Database): Promise<void> {
  try {
    log.info('Generating weekly report...');
    const ollama = new OllamaClient();
    
    // Get past 7 days of sessions
    const stmt = db.prepare(
      `SELECT start_time, app_name, summary FROM sessions 
       WHERE datetime(start_time) > datetime('now', '-7 days')
       ORDER BY start_time ASC`
    );
    const sessions = stmt.all() as Array<{ start_time: string; app_name: string; summary: string }>;
    
    // Get past 7 days of git events
    const gitStmt = db.prepare(
      `SELECT timestamp, repo_path, branch, commit_message FROM git_events
       WHERE datetime(timestamp) > datetime('now', '-7 days')
       ORDER BY timestamp ASC`
    );
    const gitEvents = gitStmt.all() as Array<{ timestamp: string; repo_path: string; branch: string; commit_message: string }>;

    let context = 'Here is the activity data for the past week:\n\nSessions:\n';
    sessions.forEach(s => {
      context += `- ${s.start_time}: ${s.app_name} - ${s.summary || 'Working'}\n`;
    });
    
    context += '\nGit Commits:\n';
    gitEvents.forEach(g => {
      context += `- ${g.timestamp}: [${g.repo_path} / ${g.branch}] ${g.commit_message}\n`;
    });

    const prompt = `You are an AI assistant. Based on the following work activity and git commits from the past week, generate a structured Weekly Markdown Report. Group by project/repo if possible, list major accomplishments, and provide a rough estimate of focus areas. \n\nData:\n${context}`;
    
    const cfg = getConfig().get();
    const result = await ollama.generate({ model: cfg.ai.textModel, prompt });

    const today = new Date().toISOString().split('T')[0];
    const insertStmt = db.prepare(
      `INSERT INTO reports (type, date, content, summary, generated_at)
       VALUES ('weekly', ?, ?, ?, datetime('now'))`
    );
    insertStmt.run(today, result, 'Weekly Timesheet & Activity Summary');
    
    log.info('Weekly report generated successfully');
  } catch (err) {
    log.warn({ err }, 'Failed to generate weekly report');
  }
}

async function generateDailyStandup(db: Database, bus: EventBus): Promise<void> {
  try {
    log.info('Generating daily standup draft...');
    const ollama = new OllamaClient();
    
    const today = new Date().toISOString().split('T')[0];

    // Get today's sessions
    const stmt = db.prepare(
      `SELECT start_time, app_name, summary FROM sessions 
       WHERE date(start_time) = ?
       ORDER BY start_time ASC`
    );
    const sessions = stmt.all(today) as Array<{ start_time: string; app_name: string; summary: string }>;
    
    // Get today's git events
    const gitStmt = db.prepare(
      `SELECT timestamp, repo_path, branch, commit_message FROM git_events
       WHERE date(timestamp) = ?
       ORDER BY timestamp ASC`
    );
    const gitEvents = gitStmt.all(today) as Array<{ timestamp: string; repo_path: string; branch: string; commit_message: string }>;

    let context = 'Here is the activity data for today:\n\nSessions:\n';
    sessions.forEach(s => {
      context += `- ${new Date(s.start_time).toLocaleTimeString()}: ${s.app_name} - ${s.summary || 'Working'}\n`;
    });
    
    context += '\nGit Commits:\n';
    gitEvents.forEach(g => {
      context += `- ${new Date(g.timestamp).toLocaleTimeString()}: [${g.repo_path} / ${g.branch}] ${g.commit_message}\n`;
    });

    const prompt = `You are an AI assistant. Based on the following work activity and git commits from today, draft a short, professional "Daily Standup" update. 
    Use the format:
    **What I did today:** (summarize major tasks/projects based on sessions and commits)
    **Blockers:** (infer if there was lots of thrashing or web searching for errors, otherwise say "None")
    **What's next:** (guess what logical next step is, or say "Continuing current work")
    
    Data:\n${context}`;
    
    const cfg = getConfig().get();
    const result = await ollama.generate({ model: cfg.ai.textModel, prompt });

    const insertStmt = db.prepare(
      `INSERT INTO reports (type, date, content, summary, generated_at)
       VALUES ('daily_standup', ?, ?, ?, datetime('now'))`
    );
    insertStmt.run(today, result, 'Daily Standup Draft');
    
    bus.emit('STANDUP_READY', 'scheduler', { content: result });
    
    log.info('Daily standup generated successfully');
  } catch (err) {
    log.warn({ err }, 'Failed to generate daily standup');
  }
}

async function cleanupAnalyzedScreenshots(db: Database): Promise<void> {
  try {
    log.info('Running end-of-day screenshot cleanup...');
    const stmt = db.prepare(
      `SELECT id, file_path FROM screenshots 
       WHERE (ai_processed = 1 OR ocr_processed = 1) 
       AND date(timestamp) < date('now', 'localtime')`
    );
    const screenshots = stmt.all() as Array<{ id: number; file_path: string }>;

    let deleted = 0;
    for (const s of screenshots) {
      try {
        await fs.promises.unlink(s.file_path);
        deleted++;
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          log.warn({ err, file: s.file_path }, 'Failed to delete screenshot');
        }
      }
    }
    log.info(`Cleaned up ${deleted} analyzed screenshots.`);
  } catch (err) {
    log.warn({ err }, 'Screenshot cleanup failed');
  }
}

async function processUnprocessedScreenshots(db: Database, bus: EventBus): Promise<void> {
  try {
    const stmt = db.prepare(
      `SELECT id, file_path, timestamp FROM screenshots WHERE ocr_processed = 0 LIMIT 5`
    );
    const unprocessed = stmt.all() as Array<{ id: number; file_path: string; timestamp: string }>;

    for (const screenshot of unprocessed) {
      // Mark as processing to avoid re-processing
      db.prepare('UPDATE screenshots SET ocr_processed = -1 WHERE id = ?').run(screenshot.id);

      bus.emit('SCREENSHOT_PROCESSED', 'ai-pipeline', {
        screenshotId: screenshot.id,
        filePath: screenshot.file_path,
        needsOCR: true,
        needsVision: true,
        timestamp: screenshot.timestamp,
      });
    }
  } catch (err) {
    log.warn({ err }, 'Failed to process unprocessed screenshots');
  }
}

function generateSessionSummary(db: Database): void {
  try {
    // Find sessions without summaries that ended > 30 min ago
    const stmt = db.prepare(
      `SELECT id, start_time, end_time, app_name FROM sessions 
       WHERE summary IS NULL AND end_time IS NOT NULL 
       AND datetime(end_time) < datetime('now', '-30 minutes')
       LIMIT 5`
    );
    const sessions = stmt.all() as Array<{
      id: number;
      start_time: string;
      end_time: string;
      app_name: string;
    }>;

    log.debug({ count: sessions.length }, 'Sessions needing summaries');
  } catch (err) {
    log.warn({ err }, 'Failed to generate session summary');
  }
}

function rebuildTimeline(db: Database): void {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();

    // Count activities for this hour
    const stmt = db.prepare(
      `SELECT COUNT(*) as count, app_name FROM activities 
       WHERE date(timestamp) = ? AND strftime('%H', timestamp) = ?
       GROUP BY app_name ORDER BY count DESC LIMIT 1`
    );
    const topApp = stmt.get(today, hour.toString().padStart(2, '0')) as {
      count: number;
      app_name: string;
    } | undefined;

    // Upsert timeline
    const upsert = db.prepare(
      `INSERT INTO timeline (date, hour, primary_app, activity_summary, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(date, hour) DO UPDATE SET primary_app = ?, activity_summary = ?`
    );

    // Note: SQLite doesn't have unique constraint on (date, hour) by default
    // We handle this with a delete + insert approach
    db.prepare('DELETE FROM timeline WHERE date = ? AND hour = ?').run(today, hour);
    upsert.run(
      today,
      hour,
      topApp?.app_name ?? null,
      topApp ? `${topApp.app_name} (${topApp.count} activities)` : null,
      topApp?.app_name ?? null,
      topApp ? `${topApp.app_name} (${topApp.count} activities)` : null
    );
  } catch (err) {
    log.warn({ err }, 'Failed to rebuild timeline');
  }
}
