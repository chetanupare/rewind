Add-Type -AssemblyName System.Drawing
$src = 'C:\Users\User\AppData\Roaming\AIWorkMemory\screenshots\2026-06-27\02-56-22.png'
$dest = 'C:\Users\User\Projects\assis\test_compressed.jpg'
$bitmap = [System.Drawing.Bitmap]::FromFile($src)
$ratio = 1280.0 / $bitmap.Width
$newHeight = [int]($bitmap.Height * $ratio)
$resized = New-Object System.Drawing.Bitmap(1280, $newHeight)
$g = [System.Drawing.Graphics]::FromImage($resized)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bitmap, 0, 0, 1280, $newHeight)
$resized.Save($dest, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose()
$resized.Dispose()
$bitmap.Dispose()
Write-Output 'Resized successfully'
