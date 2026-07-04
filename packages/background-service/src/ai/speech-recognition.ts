import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const log = getLogger();

interface TranscriptResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  language: string;
  duration: number;
}

export class SpeechRecognition {
  private isProcessing = false;
  private whisperAvailable = false;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.checkWhisper();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        file_path TEXT,
        text TEXT NOT NULL,
        segments TEXT DEFAULT '[]',
        language TEXT DEFAULT 'en',
        duration_seconds INTEGER DEFAULT 0,
        speaker_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS speakers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transcript_id INTEGER NOT NULL,
        speaker_id TEXT NOT NULL,
        name TEXT,
        text_count INTEGER DEFAULT 0,
        total_seconds INTEGER DEFAULT 0,
        FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
      );

      CREATE INDEX IF NOT EXISTS idx_transcripts_source ON transcripts(source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_speakers_transcript ON speakers(transcript_id);
    `);
  }

  private async checkWhisper(): Promise<void> {
    try {
      const result = await this.execCommand('python', ['-c', 'import whisper; print("ok")']);
      this.whisperAvailable = result.trim() === 'ok';
    } catch {
      this.whisperAvailable = false;
    }

    if (!this.whisperAvailable) {
      try {
        const result = await this.execCommand('whisper', ['--help']);
        this.whisperAvailable = result.includes('Usage');
      } catch {
        this.whisperAvailable = false;
      }
    }

    log.info({ available: this.whisperAvailable }, 'Whisper availability checked');
  }

  async transcribeAudio(audioPath: string): Promise<TranscriptResult> {
    if (!this.whisperAvailable) {
      throw new Error('Whisper not available');
    }

    try {
      const script = `
import sys
import json
import whisper

model = whisper.load_model("base")
result = model.transcribe("${audioPath.replace(/\\/g, '\\\\')}", language="en")

output = {
    "text": result["text"],
    "segments": [],
    "language": result.get("language", "en"),
    "duration": 0
}

for seg in result.get("segments", []):
    output["segments"].append({
        "start": seg["start"],
        "end": seg["end"],
        "text": seg["text"].strip()
    })

if output["segments"]:
    output["duration"] = int(output["segments"][-1]["end"])

print(json.dumps(output))
`;

      const result = await this.execPython(script);
      const parsed = JSON.parse(result);

      return {
        text: parsed.text || '',
        segments: parsed.segments || [],
        language: parsed.language || 'en',
        duration: parsed.duration || 0,
      };
    } catch (err) {
      log.warn({ err, audioPath }, 'Whisper transcription failed');
      throw err;
    }
  }

  async transcribeAndStore(audioPath: string, sourceType: string, sourceId?: number): Promise<number | null> {
    try {
      const result = await this.transcribeAudio(audioPath);

      const dbResult = this.db.prepare(`
        INSERT INTO transcripts (source_type, source_id, file_path, text, segments, language, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        sourceType,
        sourceId || null,
        audioPath,
        result.text,
        JSON.stringify(result.segments),
        result.language,
        result.duration
      );

      const transcriptId = dbResult.lastInsertRowid as number;

      this.bus.emit('TRANSCRIPT_READY', 'speech-recognition', {
        transcriptId,
        sourceType,
        sourceId,
        textLength: result.text.length,
        duration: result.duration,
      });

      log.info({ transcriptId, textLength: result.text.length }, 'Transcript stored');
      return transcriptId;
    } catch (err) {
      log.warn({ err, audioPath }, 'Failed to transcribe audio');
      return null;
    }
  }

  async searchTranscripts(query: string, limit = 10): Promise<Array<{
    id: number;
    text: string;
    sourceType: string;
    timestamp: string;
  }>> {
    return this.db.prepare(`
      SELECT id, text, source_type, created_at as timestamp
      FROM transcripts
      WHERE text LIKE ?
      ORDER BY created_at DESC LIMIT ?
    `).all(`%${query}%`, limit) as any[];
  }

  async getTranscripts(sourceType?: string, limit = 20): Promise<any[]> {
    let query = 'SELECT * FROM transcripts';
    const params: unknown[] = [];

    if (sourceType) {
      query += ' WHERE source_type = ?';
      params.push(sourceType);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(query).all(...params);
  }

  isAvailable(): boolean {
    return this.whisperAvailable;
  }

  private execCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(command, args, { timeout: 10000, windowsHide: true }, (err, stdout) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(stdout);
      });
    });
  }

  private execPython(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptFile = path.join(os.tmpdir(), `rewindx-whisper-${Date.now()}.py`);
      fs.writeFileSync(scriptFile, script, 'utf-8');

      execFile('python', [scriptFile], { timeout: 120000, windowsHide: true }, (err, stdout) => {
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
