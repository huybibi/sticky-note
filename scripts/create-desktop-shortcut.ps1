$ErrorActionPreference = 'Stop'
$appDir = 'D:\AI-Agent\Cline\sticky-note'
$desktop = [Environment]::GetFolderPath('Desktop')

# tao icon.ico tu icon.png neu chua co (file .ico nhi phan, khong phai anh doi ten)
if (-not (Test-Path "$appDir\assets\icon.ico")) {
  $png = [IO.File]::ReadAllBytes("$appDir\assets\icon.png")
  $ms = New-Object IO.MemoryStream
  $w = New-Object IO.BinaryWriter($ms)
  $w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)
  $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32)
  $w.Write([uint32]$png.Length); $w.Write([uint32]22)
  $w.Write($png); $w.Flush()
  [IO.File]::WriteAllBytes("$appDir\assets\icon.ico", $ms.ToArray())
  $w.Close()
}

$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut("$desktop\Sticky Note.lnk")
$lnk.TargetPath = "$appDir\node_modules\electron\dist\electron.exe"
$lnk.Arguments = "`"$appDir`""
$lnk.WorkingDirectory = $appDir
$lnk.IconLocation = "$appDir\assets\icon.ico,0"
$lnk.Description = 'Sticky Note - giay nho desktop'
$lnk.WindowStyle = 1
$lnk.Save()
'Da tao shortcut: ' + "$desktop\Sticky Note.lnk"
