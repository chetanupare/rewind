import { EventBus, Database, getConfig, getLogger } from '@ai-work-memory/shared';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import sharp from 'sharp';

const log = getLogger();
const fsPromises = fs.promises;

export class ScreenshotService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private isCapturing = false;
  private lastAppChange: string = '';

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const appName = event.payload.appName as string;
      if (appName !== this.lastAppChange) {
        this.lastAppChange = appName;
        this.capture('app_change');
      }
    });
  }

  async start(): Promise<void> {
    const cfg = getConfig().get();
    this.interval = setInterval(() => this.capture('interval'), cfg.screenshot.intervalMs);
    log.info({ intervalMs: cfg.screenshot.intervalMs }, 'Screenshot service started');
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private capture(trigger: 'interval' | 'app_change'): void {
    if (this.isCapturing) return;
    if (!getConfig().get().privacy.storeScreenshots) return;

    this.isCapturing = true;
    this.doCapture(trigger).catch(() => {}).finally(() => { this.isCapturing = false; });
  }

  private async doCapture(trigger: 'interval' | 'app_change'): Promise<void> {
    const now = new Date();
    const dateDir = path.join(
      getConfig().get().screenshotsDir,
      now.toISOString().split('T')[0]
    );
    await fsPromises.mkdir(dateDir, { recursive: true });

    const filename = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}.jpg`;
    const filePath = path.join(dateDir, filename);

    const escapedPath = filePath.replace(/\\/g, '\\\\');
    const captureScript = `Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$targetWidth = 1024
if ($bounds.Width -gt $targetWidth) {
    $ratio = $targetWidth / $bounds.Width
    $newHeight = [int]($bounds.Height * $ratio)
} else {
    $targetWidth = $bounds.Width
    $newHeight = $bounds.Height
}

$resized = New-Object System.Drawing.Bitmap($targetWidth, $newHeight)
$g2 = [System.Drawing.Graphics]::FromImage($resized)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bitmap, 0, 0, $targetWidth, $newHeight)

$resized.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Jpeg)

$g2.Dispose()
$resized.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
Write-Output "OK|$($bounds.Width)|$($bounds.Height)"`;

    const scriptFile = path.join(os.tmpdir(), `awm-ss-${process.pid}-${Date.now()}.ps1`);
    await fsPromises.writeFile(scriptFile, captureScript, 'utf-8');

    const stdout = await new Promise<string>((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptFile],
        { timeout: 15000, windowsHide: true },
        (_err, out) => resolve(out || '')
      );
    });

    try { await fsPromises.unlink(scriptFile); } catch {}

    const output = stdout.trim();
    if (!output.startsWith('OK')) {
      try { await fsPromises.access(filePath); } catch { return; }
    }

    let screenWidth = 1920;
    let screenHeight = 1080;
    const parts = output.split('|');
    if (parts.length >= 3) {
      const w = parseInt(parts[1], 10);
      const h = parseInt(parts[2], 10);
      if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
        screenWidth = w;
        screenHeight = h;
      }
    }

    const buf = await fsPromises.readFile(filePath);
    
    const webpBuf = await sharp(buf).webp({ quality: 80 }).toBuffer();
    const webpPath = filePath.replace('.jpg', '.webp');
    await fsPromises.writeFile(webpPath, webpBuf);
    
    try { await fsPromises.unlink(filePath); } catch {}

    const imageHash = createHash('md5').update(webpBuf).digest('hex');

    const stmt = this.db.prepare(
      `INSERT INTO screenshots (timestamp, file_path, image_hash, width, height)
       VALUES (?, ?, ?, ?, ?)`
    );
    const result = stmt.run(now.toISOString(), webpPath, imageHash, screenWidth, screenHeight);
    const screenshotId = result.lastInsertRowid as number;

    this.bus.emit('SCREENSHOT_CAPTURED', 'screenshot-service', {
      filePath: webpPath,
      imageHash,
      trigger,
      screenshotId,
      width: screenWidth,
      height: screenHeight,
    });

    this.bus.emit('SCREENSHOT_PROCESSED', 'ai-pipeline', {
      screenshotId,
      filePath: webpPath,
      needsOCR: false,
      needsVision: true,
      timestamp: now.toISOString(),
    });

    log.debug({ filePath, trigger, width: screenWidth, height: screenHeight }, 'Screenshot captured');
  }
}
