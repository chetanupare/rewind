import { getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const log = getLogger();

interface OcrResult {
  text: string;
  confidence: number;
  engine: string;
  language: string;
  words: Array<{ text: string; confidence: number; bbox: number[] }>;
}

interface OcrEngine {
  name: string;
  available: boolean;
  priority: number;
  extract(imagePath: string): Promise<OcrResult>;
}

export class MultiEngineOcr {
  private engines: OcrEngine[] = [];
  private scriptPath: string;

  constructor() {
    this.scriptPath = path.join(os.tmpdir(), `rewindx-ocr-${process.pid}.py`);
    this.initializeEngines();
  }

  private async initializeEngines(): Promise<void> {
    this.engines = [
      {
        name: 'PaddleOCR',
        available: await this.checkPaddleOCR(),
        priority: 1,
        extract: (img) => this.paddleOcr(img),
      },
      {
        name: 'EasyOCR',
        available: await this.checkEasyOCR(),
        priority: 2,
        extract: (img) => this.easyOcr(img),
      },
      {
        name: 'Tesseract',
        available: await this.checkTesseract(),
        priority: 3,
        extract: (img) => this.tesseractOcr(img),
      },
      {
        name: 'WindowsOCR',
        available: true,
        priority: 4,
        extract: (img) => this.windowsOcr(img),
      },
    ];

    this.engines.sort((a, b) => a.priority - b.priority);
    log.info({
      available: this.engines.filter(e => e.available).map(e => e.name),
    }, 'OCR engines initialized');
  }

  private async checkPaddleOCR(): Promise<boolean> {
    try {
      const result = await this.execPython('import paddleocr; print("ok")');
      return result.trim() === 'ok';
    } catch {
      return false;
    }
  }

  private async checkEasyOCR(): Promise<boolean> {
    try {
      const result = await this.execPython('import easyocr; print("ok")');
      return result.trim() === 'ok';
    } catch {
      return false;
    }
  }

  private async checkTesseract(): Promise<boolean> {
    const paths = [
      'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
      'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
    ];
    return paths.some(p => fs.existsSync(p));
  }

  async extractText(imagePath: string): Promise<OcrResult> {
    for (const engine of this.engines) {
      if (!engine.available) continue;

      try {
        const result = await engine.extract(imagePath);
        if (result.text && result.text.trim().length > 10) {
          log.info({ engine: engine.name, textLength: result.text.length }, 'OCR successful');
          return result;
        }
      } catch (err) {
        log.debug({ engine: engine.name, err }, 'OCR engine failed, trying next');
      }
    }

    return { text: '', confidence: 0, engine: 'none', language: 'en', words: [] };
  }

  private async paddleOcr(imagePath: string): Promise<OcrResult> {
    const script = `
import sys
import json
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
result = ocr.ocr('${imagePath.replace(/\\/g, '\\\\')}', cls=True)

output = {"text": "", "words": [], "confidence": 0}
if result and result[0]:
    texts = []
    total_conf = 0
    for line in result[0]:
        text = line[1][0]
        conf = line[1][1]
        bbox = line[0]
        texts.append(text)
        total_conf += conf
        output["words"].append({"text": text, "confidence": conf, "bbox": [int(bbox[0][0]), int(bbox[0][1]), int(bbox[2][0]), int(bbox[2][1])]})
    output["text"] = " ".join(texts)
    output["confidence"] = total_conf / len(result[0]) if result[0] else 0

print(json.dumps(output))
`;

    const result = await this.execPython(script);
    const parsed = JSON.parse(result);
    return {
      text: parsed.text || '',
      confidence: parsed.confidence || 0,
      engine: 'PaddleOCR',
      language: 'en',
      words: parsed.words || [],
    };
  }

  private async easyOcr(imagePath: string): Promise<OcrResult> {
    const script = `
import sys
import json
import easyocr

reader = easyocr.Reader(['en'], gpu=False)
result = reader.readtext('${imagePath.replace(/\\/g, '\\\\')}')

output = {"text": "", "words": [], "confidence": 0}
texts = []
total_conf = 0
for (bbox, text, conf) in result:
    texts.append(text)
    total_conf += conf
    output["words"].append({"text": text, "confidence": conf, "bbox": [int(bbox[0][0]), int(bbox[0][1]), int(bbox[2][0]), int(bbox[2][1])]})
output["text"] = " ".join(texts)
output["confidence"] = total_conf / len(result) if result else 0

print(json.dumps(output))
`;

    const result = await this.execPython(script);
    const parsed = JSON.parse(result);
    return {
      text: parsed.text || '',
      confidence: parsed.confidence || 0,
      engine: 'EasyOCR',
      language: 'en',
      words: parsed.words || [],
    };
  }

  private async tesseractOcr(imagePath: string): Promise<OcrResult> {
    return new Promise((resolve, reject) => {
      const tesseractPath = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
      
      execFile(tesseractPath, [imagePath, 'stdout', '-l', 'eng', '--psm', '6'], 
        { timeout: 30000, windowsHide: true },
        (err, stdout) => {
          if (err) {
            reject(new Error('Tesseract failed'));
            return;
          }
          resolve({
            text: (stdout || '').trim(),
            confidence: 0.7,
            engine: 'Tesseract',
            language: 'en',
            words: [],
          });
        }
      );
    });
  }

  private async windowsOcr(imagePath: string): Promise<OcrResult> {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try {
    $img = [System.Drawing.Image]::FromFile('${imagePath.replace(/\\/g, '\\\\')}')
    $img.Dispose()
    Write-Output "OK"
} catch {
    Write-Output "FAIL"
}
`;

    return new Promise((resolve, reject) => {
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { timeout: 10000, windowsHide: true },
        (err, stdout) => {
          if (err || stdout.trim() !== 'OK') {
            reject(new Error('Windows OCR failed'));
            return;
          }
          resolve({
            text: '',
            confidence: 0.5,
            engine: 'WindowsOCR',
            language: 'en',
            words: [],
          });
        }
      );
    });
  }

  private execPython(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptFile = path.join(os.tmpdir(), `rewindx-ocr-${Date.now()}.py`);
      fs.writeFileSync(scriptFile, script, 'utf-8');

      execFile('python', [scriptFile], { timeout: 60000, windowsHide: true }, (err, stdout) => {
        try { fs.unlinkSync(scriptFile); } catch {}
        if (err) {
          reject(err);
          return;
        }
        resolve(stdout);
      });
    });
  }

  getAvailableEngines(): string[] {
    return this.engines.filter(e => e.available).map(e => e.name);
  }
}
