param(
    [Parameter(Mandatory = $true)][string] $Setup,
    [Parameter(Mandatory = $true)][string] $Dest,
    [string] $UninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TypeWords',
    [string] $ResultPath,
    [int] $TimeoutMs = 180000,
    [switch] $DryRun
)
$ErrorActionPreference = 'Stop'

function ConvertTo-TypeWordsVersion([string] $Value) {
    $trimmed = "$Value".Trim()
    if ($trimmed -notmatch '^\d+(\.\d+){1,3}$') {
        throw "Invalid TypeWords version: $Value"
    }
    return [version]$trimmed
}

function Get-TypeWordsSetupVersion([string] $SetupPath) {
    $name = [IO.Path]::GetFileName($SetupPath)
    if ($name -notmatch '^TypeWords_(\d+\.\d+\.\d+)_x64-setup\.exe$') {
        throw "Setup filename must be TypeWords_<version>_x64-setup.exe: $name"
    }
    return $Matches[1]
}

function Write-TypeWordsSetupResult($Record, [int] $Code) {
    $json = $Record | ConvertTo-Json -Depth 6
    if ($ResultPath) {
        [IO.File]::WriteAllText($ResultPath, $json, [Text.UTF8Encoding]::new($false))
    }
    Write-Output $json
    exit $Code
}

if (!(Test-Path -LiteralPath $Setup)) { throw "Missing installer: $Setup" }

$setupVersion = Get-TypeWordsSetupVersion $Setup
$displayVersion = $null
if (Test-Path -LiteralPath $UninstallKey) {
    $displayVersion = (Get-ItemProperty -LiteralPath $UninstallKey).DisplayVersion
}

$record = [ordered]@{
    setup = $Setup
    dest = $Dest
    setupVersion = $setupVersion
    displayVersion = $displayVersion
    dryRun = [bool]$DryRun
    refused = $false
    launched = $false
    reason = $null
    installerExit = $null
}

if ($displayVersion) {
    $installed = ConvertTo-TypeWordsVersion $displayVersion
    $incoming = ConvertTo-TypeWordsVersion $setupVersion
    if ($installed -gt $incoming) {
        $record.refused = $true
        $record.reason = "installed DisplayVersion $displayVersion is newer than setup $setupVersion"
        Write-TypeWordsSetupResult $record 2
    }
}

if ($DryRun) {
    $record.reason = 'allowed'
    Write-TypeWordsSetupResult $record 0
}

$process = Start-Process -FilePath $Setup -ArgumentList "/S /NS /D=$Dest" -PassThru
$record.launched = $true
if (-not $process.WaitForExit($TimeoutMs)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    $record.reason = 'installer timeout'
    $record.installerExit = $null
    Write-TypeWordsSetupResult $record 1
}
$record.installerExit = $process.ExitCode
$record.reason = 'launched'
Write-TypeWordsSetupResult $record $process.ExitCode
