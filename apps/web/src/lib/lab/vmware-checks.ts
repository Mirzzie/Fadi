/**
 * One line, so nothing runs until Enter. Idempotent: running it twice adds nothing twice.
 * Windows Server 2025 ships OpenSSH Server (disabled); older Windows installs it first.
 */
export function checksSetupScript(publicKey: string, hostAddresses: string[]): string {
  return [
    `$k='${publicKey.replace(/'/g, "")}'`,
    "if (-not (Get-Service sshd -ErrorAction SilentlyContinue)) { Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null }",
    "Set-Service sshd -StartupType Automatic",
    "Start-Service sshd",
    '$f="$env:ProgramData\\ssh\\administrators_authorized_keys"',
    "if (-not (Test-Path $f) -or -not (Select-String -Path $f -SimpleMatch $k -Quiet)) { Add-Content -Path $f -Value $k }",
    'icacls $f /inheritance:r /grant "*S-1-5-32-544:F" /grant "SYSTEM:F" | Out-Null',
    `if (-not (Get-NetFirewallRule -Name fadi-ssh -ErrorAction SilentlyContinue)) { New-NetFirewallRule -Name fadi-ssh -DisplayName 'Fadi lab checks (SSH)' -Protocol TCP -LocalPort 22 -RemoteAddress ${hostAddresses.join(",")} -Action Allow | Out-Null }`,
    "Write-Output 'Fadi checks are set up.'",
  ].join("; ");
}
