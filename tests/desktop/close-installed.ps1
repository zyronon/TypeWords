param([Parameter(Mandatory = $true)][string] $Stage)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'cdp-port.ps1')
$launch = Get-Content -LiteralPath (Join-Path $Stage 'launch.json') -Raw | ConvertFrom-Json
$process = Get-Process -Id $launch.pid -ErrorAction Stop
if (!$process.CloseMainWindow()) { throw 'Normal close failed' }
if (!$process.WaitForExit(15000)) { throw 'Process did not exit normally' }
if (Get-Process -Id $launch.pid -ErrorAction SilentlyContinue) { throw 'Process still running' }
if (-not (Wait-TypeWordsCdp $launch.port $false 20)) {
    throw "CDP $($launch.port) still answered after a normal close"
}
@{
    closedPid = $launch.pid
    exitCode = $process.ExitCode
    profileRetained = [bool](Test-Path -LiteralPath (Join-Path $launch.profile 'EBWebView'))
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Stage 'closed.json') -Encoding utf8
Write-Output "Normally closed $($launch.pid); isolated profile retained=$([bool](Test-Path -LiteralPath (Join-Path $launch.profile 'EBWebView')))"
