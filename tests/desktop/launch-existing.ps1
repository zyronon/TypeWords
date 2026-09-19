param([Parameter(Mandatory = $true)][string] $Stage)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'cdp-port.ps1')
$exe = Join-Path $Stage 'installed\typewords-desktop.exe'
$profile = Join-Path $Stage 'isolated-profile'
$previous = Get-Content -LiteralPath (Join-Path $Stage 'launch.json') -Raw | ConvertFrom-Json
if (!(Test-Path -LiteralPath $exe)) { throw "Missing installed EXE: $exe" }
if (!(Test-Path -LiteralPath "$profile\EBWebView")) { throw 'Expected the existing isolated profile' }
if (Get-Process typewords-desktop -ErrorAction SilentlyContinue) { throw 'TypeWords is already running' }
if (Test-TypeWordsCdp $previous.port) { throw "CDP $($previous.port) is occupied" }
$env:WEBVIEW2_USER_DATA_FOLDER = $profile
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$($previous.port) --remote-debugging-address=127.0.0.1"
$process = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
if (-not (Wait-TypeWordsCdp $previous.port $true 30)) {
    throw "Started PID $($process.Id) but CDP $($previous.port) did not open"
}
$record = @{
    pid = $process.Id
    exe = $exe
    profile = $profile
    port = $previous.port
    sha256 = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
    productVersion = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
}
$record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Stage 'launch.json') -Encoding utf8
$record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Stage 'restart.json') -Encoding utf8
Write-Output "Started existing isolated profile PID=$($process.Id) version=$($record.productVersion)"
