param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\src-tauri\windows\branding")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$output = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($output) | Out-Null

function New-BrandBitmap {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Path,
    [ValidateSet("sidebar", "header", "dialog", "banner")]
    [string]$Variant
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  try {
    $bounds = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
    $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      $bounds,
      [System.Drawing.Color]::FromArgb(255, 5, 6, 10),
      [System.Drawing.Color]::FromArgb(255, 14, 18, 29),
      32.0
    )
    $graphics.FillRectangle($background, $bounds)
    $background.Dispose()

    $gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(20, 120, 145, 185), 1)
    for ($x = 0; $x -lt $Width; $x += 22) {
      $graphics.DrawLine($gridPen, $x, 0, $x, $Height)
    }
    for ($y = 0; $y -lt $Height; $y += 22) {
      $graphics.DrawLine($gridPen, 0, $y, $Width, $y)
    }
    $gridPen.Dispose()

    $isWide = $Variant -in @("dialog", "banner")
    $centerX = if ($isWide) { [int]($Width * 0.78) } else { [int]($Width * 0.50) }
    $centerY = if ($Variant -eq "sidebar") { 112 } elseif ($Variant -eq "header") { 28 } else { [int]($Height * 0.48) }
    $radius = if ($Variant -eq "sidebar") { 46 } elseif ($Variant -eq "header") { 20 } elseif ($Variant -eq "banner") { 24 } else { 82 }

    for ($glow = 18; $glow -ge 2; $glow -= 2) {
      $alpha = [Math]::Max(4, 26 - $glow)
      $glowPen = [System.Drawing.Pen]::new(
        [System.Drawing.Color]::FromArgb($alpha, 118, 72, 210),
        $glow
      )
      $graphics.DrawEllipse(
        $glowPen,
        $centerX - $radius,
        $centerY - $radius,
        $radius * 2,
        $radius * 2
      )
      $glowPen.Dispose()
    }

    $orbBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 1, 2, 5))
    $graphics.FillEllipse(
      $orbBrush,
      $centerX - $radius,
      $centerY - $radius,
      $radius * 2,
      $radius * 2
    )
    $orbBrush.Dispose()

    $ringPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(230, 226, 234, 245), 2)
    $graphics.DrawArc(
      $ringPen,
      $centerX - $radius,
      $centerY - $radius,
      $radius * 2,
      $radius * 2,
      58,
      244
    )
    $ringPen.Dispose()

    $flarePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(245, 255, 151, 59), 3)
    $graphics.DrawArc(
      $flarePen,
      $centerX - $radius,
      $centerY - $radius,
      $radius * 2,
      $radius * 2,
      314,
      42
    )
    $graphics.DrawLine(
      $flarePen,
      $centerX + $radius - 2,
      $centerY,
      [Math]::Min($Width - 8, $centerX + $radius + [int]($radius * 0.62)),
      $centerY
    )
    $flarePen.Dispose()

    $signalPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(90, 73, 188, 255), 1)
    $signalPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dot
    $graphics.DrawLine($signalPen, 12, $Height - 24, $Width - 12, $Height - 24)
    $signalPen.Dispose()

    $titleSize = if ($Variant -eq "sidebar") { 12.0 } elseif ($Variant -eq "dialog") { 17.0 } else { 8.5 }
    $titleFont = [System.Drawing.Font]::new(
      "Bahnschrift",
      $titleSize,
      [System.Drawing.FontStyle]::Bold,
      [System.Drawing.GraphicsUnit]::Point
    )
    $captionFont = [System.Drawing.Font]::new(
      "Segoe UI",
      $(if ($Variant -eq "dialog") { 8.5 } else { 6.5 }),
      [System.Drawing.FontStyle]::Regular,
      [System.Drawing.GraphicsUnit]::Point
    )
    $titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(242, 238, 242, 250))
    $captionBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(190, 159, 172, 197))

    if ($Variant -eq "sidebar") {
      $titleFormat = [System.Drawing.StringFormat]::new()
      $titleFormat.Alignment = [System.Drawing.StringAlignment]::Center
      $graphics.DrawString("E C L I P S E", $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(8, 184, $Width - 16, 24), $titleFormat)
      $graphics.DrawString("C H A T", $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(8, 208, $Width - 16, 24), $titleFormat)
      $graphics.DrawString("PRIVATE / INTELLIGENT", $captionFont, $captionBrush, [System.Drawing.RectangleF]::new(8, 250, $Width - 16, 18), $titleFormat)
      $graphics.DrawString("ENGINEERED", $captionFont, $captionBrush, [System.Drawing.RectangleF]::new(8, 266, $Width - 16, 18), $titleFormat)
      $titleFormat.Dispose()
    } elseif ($Variant -eq "dialog") {
      $graphics.DrawString("E C L I P S E  C H A T", $titleFont, $titleBrush, 34, 54)
      $graphics.DrawString("FOCUS. COMMUNICATE. BUILD.", $captionFont, $captionBrush, 36, 86)
      $accentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(225, 255, 151, 59))
      $graphics.FillRectangle($accentBrush, 36, 116, 74, 2)
      $accentBrush.Dispose()
    } else {
      $graphics.DrawString("ECLIPSE CHAT", $titleFont, $titleBrush, 10, [Math]::Max(8, [int](($Height - 20) / 2)))
    }

    $titleFont.Dispose()
    $captionFont.Dispose()
    $titleBrush.Dispose()
    $captionBrush.Dispose()

    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-BrandBitmap -Width 164 -Height 314 -Path (Join-Path $output "nsis-sidebar.bmp") -Variant "sidebar"
New-BrandBitmap -Width 150 -Height 57 -Path (Join-Path $output "nsis-header.bmp") -Variant "header"
New-BrandBitmap -Width 493 -Height 312 -Path (Join-Path $output "wix-dialog.bmp") -Variant "dialog"
New-BrandBitmap -Width 493 -Height 58 -Path (Join-Path $output "wix-banner.bmp") -Variant "banner"

Write-Output "Installer branding assets generated in $output"
