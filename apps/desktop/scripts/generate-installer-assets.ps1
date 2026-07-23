param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\src-tauri\windows\branding"),
  [string]$LogoPath = (Join-Path $PSScriptRoot "..\..\web\public\eclipse-chat-icon-master.png")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$output = [System.IO.Path]::GetFullPath($OutputDirectory)
$logoSource = [System.IO.Path]::GetFullPath($LogoPath)

if (-not (Test-Path -LiteralPath $logoSource)) {
  throw "Eclipse Chat logo source was not found: $logoSource"
}

[System.IO.Directory]::CreateDirectory($output) | Out-Null
$logo = [System.Drawing.Image]::FromFile($logoSource)

function Add-Atmosphere {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height
  )

  $bounds = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bounds,
    [System.Drawing.Color]::FromArgb(255, 5, 7, 12),
    [System.Drawing.Color]::FromArgb(255, 16, 20, 31),
    28.0
  )
  $Graphics.FillRectangle($background, $bounds)
  $background.Dispose()

  $gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(18, 120, 145, 185), 1)
  for ($x = 0; $x -lt $Width; $x += 24) {
    $Graphics.DrawLine($gridPen, $x, 0, $x, $Height)
  }
  for ($y = 0; $y -lt $Height; $y += 24) {
    $Graphics.DrawLine($gridPen, 0, $y, $Width, $y)
  }
  $gridPen.Dispose()

  $violetGlow = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $violetGlow.AddEllipse(
    [int]($Width * 0.50),
    [int]($Height * 0.36),
    [Math]::Max(80, [int]($Width * 0.68)),
    [Math]::Max(80, [int]($Height * 0.72))
  )
  $glowBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new($violetGlow)
  $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(38, 102, 35, 196)
  $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 102, 35, 196))
  $Graphics.FillPath($glowBrush, $violetGlow)
  $glowBrush.Dispose()
  $violetGlow.Dispose()
}

function Add-Logo {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$X,
    [int]$Y,
    [int]$Size
  )

  $destination = [System.Drawing.Rectangle]::new($X, $Y, $Size, $Size)
  $Graphics.DrawImage($logo, $destination)
}

function Add-Text {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [float]$X,
    [float]$Y,
    [float]$Size,
    [System.Drawing.Color]$Color,
    [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular,
    [string]$Family = "Bahnschrift"
  )

  $font = [System.Drawing.Font]::new(
    $Family,
    $Size,
    $Style,
    [System.Drawing.GraphicsUnit]::Point
  )
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.DrawString($Text, $font, $brush, $X, $Y)
  $brush.Dispose()
  $font.Dispose()
}

function Add-SignalLine {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$X,
    [int]$Y,
    [int]$Width
  )

  $track = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(90, 92, 111, 142), 1)
  $Graphics.DrawLine($track, $X, $Y, $X + $Width, $Y)
  $track.Dispose()

  $accent = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(245, 255, 151, 59), 2)
  $Graphics.DrawLine($accent, $X + [int]($Width * 0.72), $Y, $X + $Width, $Y)
  $accent.Dispose()
}

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
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  try {
    Add-Atmosphere -Graphics $graphics -Width $Width -Height $Height

    $white = [System.Drawing.Color]::FromArgb(246, 241, 244, 250)
    $muted = [System.Drawing.Color]::FromArgb(205, 151, 164, 188)
    $orange = [System.Drawing.Color]::FromArgb(245, 255, 157, 68)
    $blue = [System.Drawing.Color]::FromArgb(225, 126, 165, 231)

    switch ($Variant) {
      "sidebar" {
        Add-Logo -Graphics $graphics -X 14 -Y 22 -Size 136
        Add-Text -Graphics $graphics -Text "E C L I P S E" -X 17 -Y 171 -Size 11.0 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "C H A T" -X 17 -Y 195 -Size 11.0 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "PRIVATE COMMUNICATION" -X 18 -Y 231 -Size 6.1 -Color $muted
        Add-Text -Graphics $graphics -Text "FOR OPERATORS" -X 18 -Y 245 -Size 6.1 -Color $muted
        Add-SignalLine -Graphics $graphics -X 18 -Y 277 -Width 128
        Add-Text -Graphics $graphics -Text "SECURE DESKTOP" -X 18 -Y 284 -Size 5.7 -Color $blue
        Add-Text -Graphics $graphics -Text "AUTO UPDATE" -X 99 -Y 284 -Size 5.7 -Color $orange
      }
      "header" {
        Add-Logo -Graphics $graphics -X 4 -Y 3 -Size 51
        Add-Text -Graphics $graphics -Text "ECLIPSE CHAT" -X 57 -Y 14 -Size 8.4 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "DESKTOP SYSTEM" -X 58 -Y 31 -Size 5.5 -Color $muted
        Add-SignalLine -Graphics $graphics -X 58 -Y 45 -Width 82
      }
      "dialog" {
        Add-Text -Graphics $graphics -Text "E C L I P S E  C H A T" -X 34 -Y 48 -Size 17.0 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "FOCUS. COMMUNICATE. BUILD." -X 36 -Y 81 -Size 8.2 -Color $muted
        Add-SignalLine -Graphics $graphics -X 36 -Y 112 -Width 156
        Add-Text -Graphics $graphics -Text "PRIVATE" -X 36 -Y 137 -Size 7.0 -Color $blue -Style Bold
        Add-Text -Graphics $graphics -Text "INTELLIGENT" -X 36 -Y 158 -Size 7.0 -Color $blue -Style Bold
        Add-Text -Graphics $graphics -Text "ENGINEERED" -X 36 -Y 179 -Size 7.0 -Color $orange -Style Bold
        Add-Logo -Graphics $graphics -X 275 -Y 55 -Size 184
        Add-Text -Graphics $graphics -Text "SECURE INSTALL / SIGNED UPDATES" -X 36 -Y 268 -Size 6.4 -Color $muted
      }
      "banner" {
        Add-Text -Graphics $graphics -Text "ECLIPSE CHAT" -X 18 -Y 14 -Size 10.0 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "SECURE DESKTOP / AUTO UPDATE" -X 19 -Y 34 -Size 5.8 -Color $muted
        Add-Logo -Graphics $graphics -X 432 -Y 2 -Size 54
        Add-SignalLine -Graphics $graphics -X 282 -Y 29 -Width 144
      }
    }

    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

try {
  New-BrandBitmap -Width 164 -Height 314 -Path (Join-Path $output "nsis-sidebar.bmp") -Variant "sidebar"
  New-BrandBitmap -Width 150 -Height 57 -Path (Join-Path $output "nsis-header.bmp") -Variant "header"
  New-BrandBitmap -Width 493 -Height 312 -Path (Join-Path $output "wix-dialog.bmp") -Variant "dialog"
  New-BrandBitmap -Width 493 -Height 58 -Path (Join-Path $output "wix-banner.bmp") -Variant "banner"
} finally {
  $logo.Dispose()
}

Write-Output "Installer branding assets generated from $logoSource in $output"
