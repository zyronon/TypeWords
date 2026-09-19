param(
    [Parameter(Mandatory = $true)][string] $Path,
    [int] $Seconds = 90,
    [int] $PollMs = 200
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class NativeSaveDialogWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, string lParam);
  [DllImport("user32.dll")]
  public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, StringBuilder lParam);
}
"@
$target = [System.IO.Path]::GetFullPath($Path)
if ([System.IO.File]::Exists($target)) { throw "Refusing to overwrite existing path: $target" }
$root = [System.Windows.Automation.AutomationElement]::RootElement
$windowType = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Window
)
$idCondition = {
    param([string] $Id)
    New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
        $Id
    )
}
$deadline = (Get-Date).AddSeconds($Seconds)

function Test-SaveWindow([string] $Name) {
    return $Name -match 'Save As|另存为|Save File'
}

function Get-SaveWindow {
    foreach ($proc in Get-Process typewords-desktop -ErrorAction SilentlyContinue) {
        if ($proc.MainWindowHandle -eq [IntPtr]::Zero) { continue }
        $hostWindow = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)
        if (-not $hostWindow) { continue }
        foreach ($child in $hostWindow.FindAll([System.Windows.Automation.TreeScope]::Children, $windowType)) {
            if (Test-SaveWindow $child.Current.Name) { return $child }
        }
    }
    foreach ($window in $root.FindAll([System.Windows.Automation.TreeScope]::Children, $windowType)) {
        if (Test-SaveWindow $window.Current.Name) { return $window }
    }
    return $null
}

function Focus-Window($Window) {
    $hwnd = [IntPtr]$Window.Current.NativeWindowHandle
    if ($hwnd -eq [IntPtr]::Zero) { return }
    [void][NativeSaveDialogWin]::ShowWindow($hwnd, 9)
    [void][NativeSaveDialogWin]::SetForegroundWindow($hwnd)
}

function Get-FileNameField($Window) {
    $hostField = $Window.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants,
        (& $idCondition 'FileNameControlHost')
    )
    if (-not $hostField) { return $null }
    $field = $hostField.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants,
        (& $idCondition '1001')
    )
    return $(if ($field) { $field } else { $hostField })
}

function Get-SaveButton($Window) {
    foreach ($el in $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, (& $idCondition '1'))) {
        if ($el.Current.ControlType.ProgrammaticName -match 'ListItem') { continue }
        if ($el.Current.Name -match '保存|Save') { return $el }
    }
    return $null
}

function Read-WindowText($Field) {
    $hwnd = [IntPtr]$Field.Current.NativeWindowHandle
    if ($hwnd -ne [IntPtr]::Zero) {
        $text = New-Object System.Text.StringBuilder 2048
        [void][NativeSaveDialogWin]::SendMessage($hwnd, 0x000D, [IntPtr]2048, $text)
        if ($text.Length -gt 0) { return $text.ToString() }
        $fallback = New-Object System.Text.StringBuilder 2048
        [void][NativeSaveDialogWin]::GetWindowText($hwnd, $fallback, $fallback.Capacity)
        if ($fallback.Length -gt 0) { return $fallback.ToString() }
    }
    if ($Field.GetSupportedPatterns().Contains([System.Windows.Automation.ValuePattern]::Pattern)) {
        return $Field.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value
    }
    return $Field.Current.Name
}

function Escape-SendKeys([string] $Value) {
    return [regex]::Replace($Value, '[+^%~(){}]', { param($m) '{' + $m.Value + '}' })
}

function Set-FileName($Window, [string] $Value) {
    $field = Get-FileNameField $Window
    if (-not $field) { return $false }
    $hwnd = [IntPtr]$field.Current.NativeWindowHandle
    Focus-Window $Window
    try { $field.SetFocus() } catch { }
    Start-Sleep -Milliseconds 80
    if ($hwnd -ne [IntPtr]::Zero) {
        [void][NativeSaveDialogWin]::SendMessage($hwnd, 0x000C, [IntPtr]::Zero, $Value)
    } else {
        [System.Windows.Forms.SendKeys]::SendWait('^a')
        [System.Windows.Forms.SendKeys]::SendWait((Escape-SendKeys $Value))
    }
    Start-Sleep -Milliseconds 80
    $current = Read-WindowText $field
    if ($current -ne $Value) {
        try { $field.SetFocus() } catch { }
        [System.Windows.Forms.SendKeys]::SendWait('^a')
        [System.Windows.Forms.SendKeys]::SendWait((Escape-SendKeys $Value))
        Start-Sleep -Milliseconds 80
        $current = Read-WindowText $field
    }
    if ($current -ne $Value) {
        throw "Filename field is '$current', not the required full path"
    }
    return $true
}

function Invoke-Save($Window) {
    $save = Get-SaveButton $Window
    if (-not $save) { return $null }
    $hwnd = [IntPtr]$save.Current.NativeWindowHandle
    if ($hwnd -ne [IntPtr]::Zero) {
        [void][NativeSaveDialogWin]::SendMessage($hwnd, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
        return $save.Current.Name
    }
    if ($save.GetSupportedPatterns().Contains([System.Windows.Automation.InvokePattern]::Pattern)) {
        $save.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        return $save.Current.Name
    }
    return $null
}

$used = $null
while ((Get-Date) -lt $deadline) {
    $dialog = Get-SaveWindow
    if ($dialog) {
        if (-not (Set-FileName $dialog $target)) { throw 'Save dialog had no writable file-name field' }
        $clicked = Invoke-Save $dialog
        if (-not $clicked) { throw 'Save dialog had no Save button' }
        $used = [pscustomobject]@{ path = $target; button = $clicked; window = $dialog.Current.Name }
        break
    }
    Start-Sleep -Milliseconds $PollMs
}
if (-not $used) { throw "No Save As dialog appeared within $Seconds seconds" }
$used | ConvertTo-Json -Compress
