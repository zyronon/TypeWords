param(
    [ValidateSet('Watch', 'Close')]
    [string] $Mode = 'Watch',
    [Parameter(Mandatory = $true)]
    [string] $Url,
    [Parameter(Mandatory = $true)]
    [string] $OutFile,
    [int] $Seconds = 12,
    [int] $PollMs = 120
)

$ErrorActionPreference = 'Stop'
$uri = [Uri]$Url
$needle = $uri.AbsoluteUri
$markers = New-Object System.Collections.Generic.List[string]
foreach ($item in @($uri.Host, $uri.AbsolutePath.Trim('/'), $needle, 'zyronon/TypeWords', 'github.com/zyronon/TypeWords')) {
    if (-not [string]::IsNullOrWhiteSpace($item)) { [void]$markers.Add($item) }
}
if ($uri.Host -match 'wjx\.cn') {
    foreach ($item in @('问卷星', '问卷', 'wjx.cn', 'v.wjx.cn', 'ev0W7fv')) { [void]$markers.Add($item) }
}
if ($uri.Host -match 'youdao\.com') {
    foreach ($item in @('有道', 'youdao', '词典', 'Youdao', '无法访问')) { [void]$markers.Add($item) }
    foreach ($pair in $uri.Query.TrimStart('?').Split('&')) {
        if ($pair -like 'word=*' -and $pair.Length -gt 5) {
            $word = [Uri]::UnescapeDataString($pair.Substring(5))
            if (-not [string]::IsNullOrWhiteSpace($word)) { [void]$markers.Add($word) }
        }
    }
}
if ($uri.Host -match 'enpuz\.com') {
    foreach ($item in @('enpuz', 'Enpuz', '英语语法', '语法分析', '在线英语')) { [void]$markers.Add($item) }
}
if ($uri.Host -match 'v8l\.cn') {
    foreach ($item in @('v8l', 'TG3sgVg')) { [void]$markers.Add($item) }
}
$httpsProgId = $null
try {
    $httpsProgId = (Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice').ProgId
} catch {}

function Test-UrlMarker([string] $Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    foreach ($marker in $markers) {
        if ($Text.ToLowerInvariant().Contains($marker.ToLowerInvariant())) { return $true }
    }
    return $false
}

function Get-BrowserProcesses {
    $found = New-Object System.Collections.Generic.List[object]
    foreach ($process in (Get-CimInstance Win32_Process)) {
        if (-not $process.CommandLine) { continue }
        if ($process.Name -notmatch '^(chrome|msedge|firefox|brave|opera|iexplore)\.exe$') { continue }
        if (-not (Test-UrlMarker $process.CommandLine)) { continue }
        $found.Add([pscustomobject]@{
            pid = $process.ProcessId
            name = $process.Name
            commandLine = $process.CommandLine
        })
    }
    return ,$found.ToArray()
}

$script:UiaReady = $false
$script:UiaError = $null
$script:UiaRoot = $null
$script:WindowType = $null
$script:TabType = $null
$script:ButtonType = $null
try {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $script:UiaRoot = [System.Windows.Automation.AutomationElement]::RootElement
    $script:WindowType = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Window
    )
    $script:TabType = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::TabItem
    )
    $script:ButtonType = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button
    )
    $script:UiaReady = $true
} catch {
    $script:UiaError = [string]$_
}

function Get-TopWindows {
    $found = New-Object System.Collections.Generic.List[object]
    if (-not $script:UiaReady) { return ,$found.ToArray() }
    foreach ($window in $script:UiaRoot.FindAll([System.Windows.Automation.TreeScope]::Children, $script:WindowType)) {
        $name = $window.Current.Name
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        $found.Add([pscustomobject]@{
            name = $name
            runtimeId = ($window.GetRuntimeId() -join ',')
        })
    }
    return ,$found.ToArray()
}

function Get-BrowserTabs {
    $found = New-Object System.Collections.Generic.List[object]
    if (-not $script:UiaReady) { return ,$found.ToArray() }
    foreach ($window in $script:UiaRoot.FindAll([System.Windows.Automation.TreeScope]::Children, $script:WindowType)) {
        $windowName = $window.Current.Name
        if ($windowName -notmatch 'Chrome|Edge|Firefox|Brave|Chromium') { continue }
        foreach ($tab in $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $script:TabType)) {
            $found.Add([pscustomobject]@{
                name = $tab.Current.Name
                runtimeId = ($tab.GetRuntimeId() -join ',')
                window = $windowName
            })
        }
    }
    return ,$found.ToArray()
}

function Write-Json($Value) {
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($OutFile, ($Value | ConvertTo-Json -Depth 8), $utf8)
}

function Close-TabByRuntimeId([string] $RuntimeId) {
    if (-not $script:UiaReady -or [string]::IsNullOrWhiteSpace($RuntimeId)) { return $false }
    foreach ($window in $script:UiaRoot.FindAll([System.Windows.Automation.TreeScope]::Children, $script:WindowType)) {
        foreach ($tab in $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $script:TabType)) {
            if (($tab.GetRuntimeId() -join ',') -ne $RuntimeId) { continue }
            foreach ($button in $tab.FindAll([System.Windows.Automation.TreeScope]::Children, $script:ButtonType)) {
                if ($button.Current.Name -notmatch 'Close|关闭') { continue }
                $pattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
                $pattern.Invoke()
                return $true
            }
            return $false
        }
    }
    return $false
}

if ($Mode -eq 'Close') {
    $report = Get-Content -LiteralPath $OutFile -Raw -Encoding utf8 | ConvertFrom-Json
    $closed = New-Object System.Collections.Generic.List[object]
    foreach ($tab in @($report.newTabs) + @($report.retargetedTabs)) {
        if (-not (Test-UrlMarker ([string]$tab.name))) { continue }
        $ok = Close-TabByRuntimeId ([string]$tab.runtimeId)
        $closed.Add([pscustomobject]@{ runtimeId = $tab.runtimeId; name = $tab.name; closed = $ok })
    }
    $report | Add-Member -NotePropertyName closedTabs -NotePropertyValue $closed.ToArray() -Force
    Write-Json $report
    return
}

$beforeWindowIds = @{}
$beforeTabIds = @{}
$beforeTabNames = @{}
foreach ($window in (Get-TopWindows)) { $beforeWindowIds[[string]$window.runtimeId] = $true }
foreach ($tab in (Get-BrowserTabs)) {
    $id = [string]$tab.runtimeId
    $beforeTabIds[$id] = $true
    $beforeTabNames[$id] = [string]$tab.name
}
$processes = New-Object System.Collections.Generic.List[object]
$newWindows = New-Object System.Collections.Generic.List[object]
$newTabs = New-Object System.Collections.Generic.List[object]
$retargetedTabs = New-Object System.Collections.Generic.List[object]
$seenProcess = @{}
$seenWindow = @{}
$seenRetarget = @{}
$deadline = (Get-Date).AddSeconds($Seconds)

function Get-ExistingMatches {
    $found = New-Object System.Collections.Generic.List[object]
    foreach ($tab in (Get-BrowserTabs)) {
        if (Test-UrlMarker $tab.name) { $found.Add($tab) }
    }
    foreach ($window in (Get-TopWindows)) {
        if (Test-UrlMarker $window.name) { $found.Add($window) }
    }
    return ,$found.ToArray()
}

function Write-Report {
    $chromeWindows = New-Object System.Collections.Generic.List[string]
    foreach ($window in (Get-TopWindows)) {
        if ($window.name -match 'Chrome|Edge|Firefox|Brave|Chromium') { [void]$chromeWindows.Add($window.name) }
    }
    Write-Json ([pscustomobject]@{
        url = $needle
        httpsProgId = $httpsProgId
        uiaReady = $script:UiaReady
        uiaError = $script:UiaError
        processes = $processes.ToArray()
        newWindows = $newWindows.ToArray()
        newTabs = $newTabs.ToArray()
        retargetedTabs = $retargetedTabs.ToArray()
        existingMatches = Get-ExistingMatches
        chromeWindows = $chromeWindows.ToArray()
    })
}

Write-Report
while ((Get-Date) -lt $deadline) {
    foreach ($process in (Get-BrowserProcesses)) {
        $key = [string]$process.pid
        if ($seenProcess.ContainsKey($key)) { continue }
        $seenProcess[$key] = $true
        $processes.Add($process)
    }
    foreach ($window in (Get-TopWindows)) {
        $id = [string]$window.runtimeId
        if ($beforeWindowIds.ContainsKey($id) -or $seenWindow.ContainsKey($id)) { continue }
        if (-not (Test-UrlMarker $window.name)) { continue }
        $seenWindow[$id] = $true
        $newWindows.Add($window)
    }
    foreach ($tab in (Get-BrowserTabs)) {
        $id = [string]$tab.runtimeId
        if ($beforeTabIds.ContainsKey($id)) {
            $previous = [string]$beforeTabNames[$id]
            if ((Test-UrlMarker $tab.name) -and -not (Test-UrlMarker $previous) -and -not $seenRetarget.ContainsKey($id)) {
                $seenRetarget[$id] = $true
                $retargetedTabs.Add([pscustomobject]@{
                    name = $tab.name
                    previousName = $previous
                    runtimeId = $id
                    window = $tab.window
                })
            }
            continue
        }
        $existing = $null
        foreach ($item in $newTabs) {
            if ($item.runtimeId -eq $id) { $existing = $item; break }
        }
        if ($null -eq $existing) {
            $newTabs.Add($tab)
        } elseif ((Test-UrlMarker $tab.name) -and -not (Test-UrlMarker $existing.name)) {
            $existing.name = $tab.name
            $existing.window = $tab.window
        }
    }
    Write-Report
    Start-Sleep -Milliseconds $PollMs
}
Write-Report
