function Test-TypeWordsCdp([int] $Port) {
    try {
        $null = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 1
        return $true
    } catch {
        return $false
    }
}

function Wait-TypeWordsCdp([int] $Port, [bool] $Open, [int] $Seconds = 20) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        if ((Test-TypeWordsCdp $Port) -eq $Open) { return $true }
        Start-Sleep -Milliseconds 200
    } while ((Get-Date) -lt $deadline)
    return $false
}
