param([Parameter(Mandatory = $true)][string] $Stage)
$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot)
$wrapper = Join-Path $repo 'scripts\invoke-setup.ps1'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TypeWords'
$dest = Join-Path $Stage 'installed'
$exe = Join-Path $dest 'typewords-desktop.exe'
$setup = Join-Path $Stage 'TypeWords_0.1.2_x64-setup.exe'
$launch = Get-Content -LiteralPath (Join-Path $Stage 'launch.json') -Raw | ConvertFrom-Json
$defaultDir = Join-Path $env:LOCALAPPDATA 'io.github.zyronon.typewords'
$resultPath = Join-Path $Stage 'invoke-setup-012.json'
if (!(Test-Path -LiteralPath $wrapper)) { throw "Missing setup wrapper: $wrapper" }
if (!(Test-Path -LiteralPath $setup)) { throw "Missing 0.1.2 installer: $setup" }
if (Get-Process typewords-desktop -ErrorAction SilentlyContinue) { throw 'TypeWords must be closed before the failed-upgrade installer' }
$registered = Get-ItemProperty $key
if ($registered.DisplayVersion -ne '0.1.3' -or $registered.InstallLocation.Trim('"') -ne $dest) {
    throw 'Failed-upgrade identity mismatch; expected installed 0.1.3 at the disposable dest'
}
$before = @{
    sha256 = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
    productVersion = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
    bytes = (Get-Item -LiteralPath $exe).Length
    displayVersion = $registered.DisplayVersion
}
if ($before.sha256 -ne $launch.sha256 -or $before.productVersion -ne '0.1.3') {
    throw 'Installed EXE is not the recorded 0.1.3 candidate'
}
& $wrapper -Setup $setup -Dest $dest -ResultPath $resultPath
$wrapperExit = $LASTEXITCODE
$wrapperResult = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
$afterExe = Get-Item -LiteralPath $exe
$after = @{
    sha256 = (Get-FileHash -LiteralPath $afterExe.FullName -Algorithm SHA256).Hash
    productVersion = $afterExe.VersionInfo.ProductVersion
    bytes = $afterExe.Length
    displayVersion = (Get-ItemProperty $key).DisplayVersion
    installLocation = (Get-ItemProperty $key).InstallLocation
    profileRetained = [bool](Test-Path -LiteralPath (Join-Path $Stage 'isolated-profile\EBWebView'))
    defaultIdentifierFiles = @(Get-ChildItem -LiteralPath $defaultDir -Force -Recurse -ErrorAction SilentlyContinue).Count
}
$record = [ordered]@{
    attempted = '0.1.2 installer over installed 0.1.3 through invoke-setup; raw NSIS allowDowngrades=false is insufficient'
    installer = $setup
    installerBytes = (Get-Item -LiteralPath $setup).Length
    installerSha256 = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash
    wrapper = $wrapper
    wrapperExit = $wrapperExit
    refused = [bool]$wrapperResult.refused
    launched = [bool]$wrapperResult.launched
    reason = $wrapperResult.reason
    installerExit = $wrapperResult.installerExit
    timedOut = $false
    before = $before
    after = $after
}
$destIntact = $after.sha256 -eq $before.sha256 -and $after.productVersion -eq '0.1.3' -and $after.displayVersion -eq '0.1.3' -and $after.profileRetained -and $after.defaultIdentifierFiles -eq 0
$record.destIntact = $destIntact
$record.wrapperBlockedSilentDowngrade = $destIntact -and $record.refused -and -not $record.launched -and $wrapperExit -eq 2
if (-not $destIntact -and $after.productVersion -eq '0.1.2') {
    $restoreSetup = Join-Path $Stage 'TypeWords_0.1.3_x64-setup.exe'
    & $wrapper -Setup $restoreSetup -Dest $dest -ResultPath (Join-Path $Stage 'invoke-setup-013-restore.json')
    $restoreExit = $LASTEXITCODE
    if ($restoreExit -ne 0) { throw '0.1.3 restore installer did not exit 0 after unexpected 0.1.2 downgrade' }
    $restoredExe = Get-Item -LiteralPath $exe
    $record.restored = @{
        installerExit = $restoreExit
        sha256 = (Get-FileHash -LiteralPath $restoredExe.FullName -Algorithm SHA256).Hash
        productVersion = $restoredExe.VersionInfo.ProductVersion
        displayVersion = (Get-ItemProperty $key).DisplayVersion
        profileRetained = [bool](Test-Path -LiteralPath (Join-Path $Stage 'isolated-profile\EBWebView'))
        defaultIdentifierFiles = @(Get-ChildItem -LiteralPath $defaultDir -Force -Recurse -ErrorAction SilentlyContinue).Count
    }
}
$record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Stage 'failed-upgrade.json') -Encoding utf8
if ($record.wrapperBlockedSilentDowngrade) {
    Write-Output 'PASS: invoke-setup refused 0.1.2 over 0.1.3; EXE/registry/profile unchanged'
    return
}
if (
    $record.restored -and
    $record.restored.productVersion -eq '0.1.3' -and
    $record.restored.sha256 -eq $before.sha256 -and
    $record.restored.profileRetained -and
    $record.restored.defaultIdentifierFiles -eq 0
) {
    Write-Output 'FINDING: wrapper did not block the silent 0.1.2 downgrade; restored 0.1.3; isolated profile and unused default identifier dir kept'
    return
}
throw 'Failed-upgrade dest was not left on the recorded 0.1.3 candidate'
