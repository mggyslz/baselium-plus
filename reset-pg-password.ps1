# reset-pg-password.ps1
# Resets the PostgreSQL `postgres` user's password.
# MUST be run from an elevated (Administrator) PowerShell window, e.g.:
#   powershell -ExecutionPolicy Bypass -File reset-pg-password.ps1
#
# It briefly switches pg_hba.conf host auth to "trust", sets the new password,
# then restores the original auth method. Safe: it backs up pg_hba.conf first.

$ErrorActionPreference = 'Stop'
$pgBin    = 'C:\Program Files\PostgreSQL\16\bin'
$dataDir  = 'C:\Program Files\PostgreSQL\16\data'
$hba      = Join-Path $dataDir 'pg_hba.conf'
$hbaBak   = "$hba.bak"
$svcName  = 'postgresql-x64-16'
$newPass  = 'postgres'   # change this if you want a different password

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: not running as Administrator. Reopen PowerShell as administrator and rerun." -ForegroundColor Red
    exit 1
}

# 1. Back up the current pg_hba.conf
Copy-Item $hba $hbaBak -Force
Write-Host "Backed up pg_hba.conf to $hbaBak"

# 2. Switch host+local auth to "trust" temporarily
$lines = Get-Content $hba
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*(host|local)\s+all\s+all\s+') {
        $lines[$i] = $lines[$i] -replace '(scram-sha-256|md5|password)\s*$', 'trust'
    }
}
Set-Content $hba $lines
Write-Host "Temporarily set pg_hba.conf to 'trust'"

# 3. Restart the service and wait until it accepts connections
Restart-Service $svcName -Force
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    & "$pgBin\pg_isready.exe" -h localhost -p 5432 *> $null
    if ($LASTEXITCODE -eq 0) { break }
}
Write-Host "Service '$svcName' restarted and accepting connections"

# 4. Set the new password
& "$pgBin\psql.exe" -U postgres -h localhost -d postgres -c "ALTER USER postgres WITH PASSWORD '$newPass';"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: failed to set password." -ForegroundColor Red; exit 1 }

# 5. Restore the original pg_hba.conf and restart the service
Copy-Item $hbaBak $hba -Force
Restart-Service $svcName -Force
Write-Host "Restored pg_hba.conf and restarted the service."

Write-Host "DONE. The postgres password is now: $newPass" -ForegroundColor Green