# Liet ke font da cai tren may + kiem tra do phu dau tieng Viet (doc truc tiep tu bang cmap cua font).
# In ra stdout moi dong: <family>|<so ky tu dau bi thieu>
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName PresentationCore

# mau ky tu tieng Viet: Latin-1, Latin mo rong, Latin mo rong bo sung (day du cac dang dau)
$chars = @(0x00E0, 0x1EA7, 0x1EAF, 0x1EC3, 0x1ED9, 0x1EDF, 0x1EF9, 0x01A1, 0x01B0, 0x0111, 0x0110, 0x1EA1, 0x1EE7)

$lines = New-Object System.Collections.Generic.List[string]
foreach ($fam in [System.Windows.Media.Fonts]::SystemFontFamilies) {
  $name = $fam.Source
  if (-not $name) { continue }
  $name = $name.TrimStart('#')
  if ($name -like 'Global *') { continue }
  try {
    $tf = New-Object System.Windows.Media.Typeface($fam, [System.Windows.FontStyles]::Normal, [System.Windows.FontWeights]::Normal, [System.Windows.FontStretches]::Normal)
    $gt = $null
    if (-not $tf.TryGetGlyphTypeface([ref]$gt)) { continue }
    $miss = 0
    foreach ($c in $chars) { if (-not $gt.CharacterToGlyphMap.ContainsKey($c)) { $miss++ } }
    $lines.Add($name + '|' + $miss)
  } catch {
    # bo qua font khong doc duoc bang Typeface thuong
  }
}

$lines | Sort-Object -Unique
