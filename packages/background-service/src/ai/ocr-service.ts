import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const log = getLogger();

const OCR_SCRIPT = `
param(
    [Parameter(Mandatory=$true)]
    [string]$ImagePath
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try {
    $img = [System.Drawing.Image]::FromFile($ImagePath)
    
    $bitmap = New-Object System.Drawing.Bitmap($img)
    
    $ocrText = ""
    
    try {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

[StructLayout(LayoutKind.Sequential)]
public struct BITMAPINFOHEADER {
    public uint biSize;
    public int biWidth;
    public int biHeight;
    public ushort biPlanes;
    public ushort biBitCount;
    public uint biCompression;
    public uint biSizeImage;
    public int biXPelsPerMeter;
    public int biYPelsPerMeter;
    public uint biClrUsed;
    public uint biClrImportant;
}

[StructLayout(LayoutKind.Sequential)]
public struct BITMAPINFO {
    public BITMAPINFOHEADER bmiHeader;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
    public uint[] bmiColors;
}
"@
    } catch {}
    
    $tempFile = [System.IO.Path]::GetTempFileName() + ".png"
    $bitmap.Save($tempFile, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $bitmap.Dispose()
    $img.Dispose()
    
    $tesseractPath = $null
    $possiblePaths = @(
        "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
        "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
        "$env:LOCALAPPDATA\\Programs\\Tesseract-OCR\\tesseract.exe",
        "$env:USERPROFILE\\AppData\\Local\\Programs\\Tesseract-OCR\\tesseract.exe"
    )
    
    foreach ($p in $possiblePaths) {
        if (Test-Path $p) {
            $tesseractPath = $p
            break
        }
    }
    
    if ($tesseractPath) {
        $outputBase = [System.IO.Path]::GetTempFileName()
        & $tesseractPath $tempFile $outputBase -l eng 2>$null
        $outputFile = $outputBase + ".txt"
        if (Test-Path $outputFile) {
            $ocrText = Get-Content $outputFile -Raw
            Remove-Item $outputFile -ErrorAction SilentlyContinue
        }
    } else {
        try {
            $pythonResult = python -c "
import sys
try:
    import pytesseract
    from PIL import Image
    img = Image.open('$($tempFile -replace '\\', '\\\\')')
    text = pytesseract.image_to_string(img)
    print(text)
except Exception as e:
    print('')
" 2>$null
            if ($pythonResult) {
                $ocrText = $pythonResult
            }
        } catch {}
    }
    
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    
    Write-Output $ocrText
} catch {
    Write-Output ""
}
`;

export class OcrService {
  private processing = false;
  private scriptPath: string;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.scriptPath = path.join(os.tmpdir(), `awm-ocr-${process.pid}.ps1`);

    this.bus.on('SCREENSHOT_PROCESSED', (event) => {
      if (event.payload.needsOCR) {
        this.processOcr(event.payload.screenshotId as number, event.payload.filePath as string);
      }
    });
  }

  async start(): Promise<void> {
    try {
      await fs.promises.writeFile(this.scriptPath, OCR_SCRIPT, 'utf-8');
      log.info('OCR service started');
    } catch (err) {
      log.warn({ err }, 'Failed to write OCR script');
    }
  }

  async stop(): Promise<void> {
    try {
      await fs.promises.unlink(this.scriptPath);
    } catch {}
  }

  private async processOcr(screenshotId: number, filePath: string): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    try {
      const text = await this.extractText(filePath);

      this.db.prepare(
        'UPDATE screenshots SET ocr_text = ?, ocr_processed = 1 WHERE id = ?'
      ).run(text, screenshotId);

      this.bus.emit('OCR_COMPLETED', 'ocr-service', {
        screenshotId,
        textLength: text.length,
      });

      log.debug({ screenshotId, textLength: text.length }, 'OCR completed');
    } catch (err) {
      log.warn({ err, screenshotId }, 'OCR failed');
      this.db.prepare('UPDATE screenshots SET ocr_processed = 1 WHERE id = ?').run(screenshotId);
    } finally {
      this.processing = false;
    }
  }

  private async extractText(filePath: string): Promise<string> {
    try {
      return await this.windowsOcr(filePath);
    } catch {
      try {
        return await this.tesseractOcr(filePath);
      } catch {
        return await this.pythonOcr(filePath);
      }
    }
  }

  private async windowsOcr(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const escapedPath = filePath.replace(/\\/g, '\\\\');

      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath, '-ImagePath', filePath],
        { timeout: 30_000, windowsHide: true },
        (err, stdout) => {
          if (err) {
            reject(new Error('Windows OCR failed'));
            return;
          }

          const text = (stdout || '').trim();
          if (text.length > 0) {
            resolve(text);
          } else {
            reject(new Error('No text extracted'));
          }
        }
      );
    });
  }

  private async tesseractOcr(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const possiblePaths = [
        'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
        'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
      ];

      let tesseractPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          tesseractPath = p;
          break;
        }
      }

      if (!tesseractPath) {
        reject(new Error('Tesseract not found'));
        return;
      }

      execFile(
        tesseractPath,
        [filePath, 'stdout', '-l', 'eng'],
        { timeout: 30_000, windowsHide: true },
        (err, stdout) => {
          if (err) {
            reject(new Error('Tesseract OCR failed'));
            return;
          }

          resolve((stdout || '').trim());
        }
      );
    });
  }

  private async pythonOcr(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const escapedPath = filePath.replace(/\\/g, '\\\\');
      const pythonScript = `
import sys
try:
    import pytesseract
    from PIL import Image
    img = Image.open(r'${filePath}')
    text = pytesseract.image_to_string(img)
    print(text)
except Exception as e:
    print('')
`;

      execFile(
        'python',
        ['-c', pythonScript],
        { timeout: 30_000, windowsHide: true },
        (err, stdout) => {
          if (err) {
            reject(new Error('Python OCR failed'));
            return;
          }

          const text = (stdout || '').trim();
          if (text.length > 0) {
            resolve(text);
          } else {
            reject(new Error('No text extracted'));
          }
        }
      );
    });
  }
}
