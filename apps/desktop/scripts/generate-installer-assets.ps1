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

function C {
  param([int]$R, [int]$G, [int]$B, [int]$A = 255)
  return [System.Drawing.Color]::FromArgb($A, $R, $G, $B)
}

function Add-Atmosphere {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height
  )

  $bounds = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bounds,
    (C 7 9 15),
    (C 18 22 37),
    18.0
  )
  $Graphics.FillRectangle($background, $bounds)
  $background.Dispose()

  # A quiet grid gives the installer a technical character without competing
  # with the logo or the native installer controls.
  $gridPen = [System.Drawing.Pen]::new((C 92 110 150 18), 1)
  for ($x = -$Height; $x -lt $Width + $Height; $x += 32) {
    $Graphics.DrawLine($gridPen, $x, 0, $x + $Height, $Height)
  }
  $gridPen.Dispose()

  $glowPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $glowPath.AddEllipse(
    [int]($Width * 0.38),
    [int]($Height * 0.18),
    [Math]::Max(90, [int]($Width * 0.82)),
    [Math]::Max(90, [int]($Height * 0.82))
  )
  $glow = [System.Drawing.Drawing2D.PathGradientBrush]::new($glowPath)
  $glow.CenterColor = (C 116 101 255 28)
  $glow.SurroundColors = @((C 116 101 255 0))
  $Graphics.FillPath($glow, $glowPath)
  $glow.Dispose()
  $glowPath.Dispose()

  $edge = [System.Drawing.Pen]::new((C 243 201 105 120), 1)
  $Graphics.DrawLine($edge, [int]($Width * 0.70), $Height - 1, $Width - 1, $Height - 1)
  $edge.Dispose()
}

function Add-RoundedFill {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [System.Drawing.Rectangle]$Rectangle,
    [int]$Radius
  )

  $diameter = [Math]::Min($Radius * 2, [Math]::Min($Rectangle.Width, $Rectangle.Height))
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $Graphics.FillPath($Brush, $path)
  $path.Dispose()
}
function Add-Logo {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$X,
    [int]$Y,
    [int]$Size
  )

  $shadow = [System.Drawing.SolidBrush]::new((C 0 0 0 110))
  Add-RoundedFill -Graphics $Graphics -Brush $shadow -Rectangle ([System.Drawing.Rectangle]::new($X + 4, $Y + 7, $Size, $Size)) -Radius ([Math]::Max(10, [int]($Size * 0.18)))
  $shadow.Dispose()
  $Graphics.DrawImage($logo, [System.Drawing.Rectangle]::new($X, $Y, $Size, $Size))
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
    [string]$Family = "Segoe UI"
  )

  $font = [System.Drawing.Font]::new($Family, $Size, $Style, [System.Drawing.GraphicsUnit]::Point)
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.DrawString($Text, $font, $brush, $X, $Y)
  $brush.Dispose()
  $font.Dispose()
}

function Add-Rule {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$AccentWidth = 42
  )

  $track = [System.Drawing.Pen]::new((C 126 140 168 95), 1)
  $Graphics.DrawLine($track, $X, $Y, $X + $Width, $Y)
  $track.Dispose()

  $accent = [System.Drawing.Pen]::new((C 243 201 105 235), 2)
  $Graphics.DrawLine($accent, $X + $Width - $AccentWidth, $Y, $X + $Width, $Y)
  $accent.Dispose()
}

function Add-Pill {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [System.Drawing.Color]$Color,
    [System.Drawing.Color]$TextColor
  )

  $brush = [System.Drawing.SolidBrush]::new($Color)
  Add-RoundedFill -Graphics $Graphics -Brush $brush -Rectangle ([System.Drawing.Rectangle]::new($X, $Y, $Width, $Height)) -Radius ([Math]::Max(4, [int]($Height / 2)))
  $brush.Dispose()
  Add-Text -Graphics $Graphics -Text $Text -X ($X + 7) -Y ($Y + 3) -Size 5.2 -Color $TextColor -Style Bold
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

    $white = C 245 247 252
    $muted = C 177 187 208
    $violet = C 141 126 255
    $gold = C 243 201 105
    $panel = C 13 17 27 190

    switch ($Variant) {
      "sidebar" {
        Add-Text -Graphics $graphics -Text "ECLIPSE FORGE" -X 17 -Y 13 -Size 5.8 -Color $muted -Style Bold
        $vertical = [System.Drawing.Pen]::new($violet, 2)
        $graphics.DrawLine($vertical, 17, 34, 17, 154)
        $vertical.Dispose()
        Add-Logo -Graphics $graphics -X 34 -Y 34 -Size 105
        Add-Text -Graphics $graphics -Text "ECLIPSE" -X 18 -Y 166 -Size 12.2 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "CHAT" -X 18 -Y 187 -Size 12.2 -Color $white -Style Bold
        Add-Rule -Graphics $graphics -X 18 -Y 214 -Width 126 -AccentWidth 36
        Add-Text -Graphics $graphics -Text "КОМАНДНЫЙ ЧАТ" -X 18 -Y 225 -Size 6.2 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "ГОЛОС · ЗАДАЧИ · РЕШЕНИЯ" -X 18 -Y 240 -Size 5.6 -Color $muted
        Add-Pill -Graphics $graphics -Text "ПРИВАТНО" -X 18 -Y 264 -Width 58 -Height 16 -Color (C 22 27 42 215) -TextColor $violet
        Add-Pill -Graphics $graphics -Text "БЫСТРО" -X 82 -Y 264 -Width 45 -Height 16 -Color (C 32 29 25 215) -TextColor $gold
        Add-Text -Graphics $graphics -Text "ECLIPSE FORGE  /  DESKTOP" -X 18 -Y 290 -Size 5.0 -Color $muted
      }
      "header" {
        Add-Logo -Graphics $graphics -X 5 -Y 4 -Size 48
        Add-Text -Graphics $graphics -Text "ECLIPSE CHAT" -X 61 -Y 9 -Size 8.6 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "ECLIPSE FORGE  ·  DESKTOP" -X 62 -Y 27 -Size 5.9 -Color $muted
        Add-Rule -Graphics $graphics -X 62 -Y 46 -Width 80 -AccentWidth 22
      }
      "dialog" {
        Add-Text -Graphics $graphics -Text "ECLIPSE CHAT" -X 34 -Y 29 -Size 19.0 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "РАБОЧЕЕ ПРОСТРАНСТВО ДЛЯ КОМАНДЫ" -X 36 -Y 63 -Size 7.4 -Color $muted -Style Bold
        Add-Rule -Graphics $graphics -X 36 -Y 91 -Width 174 -AccentWidth 44
        Add-Text -Graphics $graphics -Text "ГОЛОС" -X 36 -Y 113 -Size 7.0 -Color $violet -Style Bold
        Add-Text -Graphics $graphics -Text "ЗАДАЧИ" -X 36 -Y 136 -Size 7.0 -Color $violet -Style Bold
        Add-Text -Graphics $graphics -Text "РЕШЕНИЯ" -X 36 -Y 159 -Size 7.0 -Color $gold -Style Bold
        Add-Text -Graphics $graphics -Text "Чистый интерфейс. Проверка обновлений." -X 36 -Y 208 -Size 6.8 -Color $muted
        Add-Pill -Graphics $graphics -Text "ECLIPSE FORGE  /  DESKTOP" -X 36 -Y 246 -Width 132 -Height 18 -Color $panel -TextColor $white
        Add-Logo -Graphics $graphics -X 302 -Y 68 -Size 148
        $status = [System.Drawing.Pen]::new((C 141 126 255 160), 1)
        $graphics.DrawEllipse($status, 286, 52, 181, 181)
        $status.Dispose()
      }
      "banner" {
        Add-Text -Graphics $graphics -Text "ECLIPSE CHAT" -X 18 -Y 10 -Size 10.4 -Color $white -Style Bold
        Add-Text -Graphics $graphics -Text "УСТАНОВЩИК ECLIPSE FORGE" -X 19 -Y 31 -Size 6.1 -Color $muted -Style Bold
        Add-Rule -Graphics $graphics -X 274 -Y 29 -Width 145 -AccentWidth 36
        Add-Logo -Graphics $graphics -X 433 -Y 3 -Size 52
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
