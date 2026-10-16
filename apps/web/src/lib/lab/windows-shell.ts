/**
 * EVERY COMMAND FADI SENDS TO A WINDOWS MACHINE OVER SSH RUNS IN POWERSHELL, EXPLICITLY.
 *
 * Windows OpenSSH starts remote commands with cmd.exe unless the machine's DefaultShell says
 * otherwise. Fadi's own Windows labs set it; the person's VMware machine did not — so a check
 * of `Get-Service WazuhSvc` answered "'Get-Service' is not recognized" and a broken step looked
 * like a broken check (Codex review, 16 Oct 2026). Encoding the script also means no quoting of
 * it ever reaches cmd.exe. Progress output is silenced: otherwise PowerShell writes it to stderr
 * as CLIXML.
 */

/** cmd.exe's command-line limit, with room for ssh's own wrapping. */
const MAX_COMMAND = 8000;

const PREFIX = "$ProgressPreference='SilentlyContinue'; ";
const ENCODED = /^powershell\.exe -NoProfile -NonInteractive -OutputFormat Text -EncodedCommand ([A-Za-z0-9+/=]+)$/;

/** How an encoded command is shown to the person: the script itself. Anything else unchanged. */
export function readablePowershell(arg: string): string {
  const encoded = arg.match(ENCODED)?.[1];
  if (!encoded) return arg;
  const script = Buffer.from(encoded, "base64").toString("utf16le");
  return `powershell: ${script.startsWith(PREFIX) ? script.slice(PREFIX.length) : script}`;
}

export function powershellRemote(script: string): string {
  const body = `${PREFIX}${script}`;
  const encoded = Buffer.from(body, "utf16le").toString("base64");
  const command = `powershell.exe -NoProfile -NonInteractive -OutputFormat Text -EncodedCommand ${encoded}`;
  if (command.length > MAX_COMMAND) {
    throw new Error("That check is too long to send to a Windows machine.");
  }
  return command;
}

/**
 * A check that prints its output as plain text, then `<marker>=0` when it succeeded and
 * `<marker>=1` when it didn't. Errors are folded into the output as text (left on stderr,
 * PowerShell sends them as CLIXML — the owner saw `_x000D__x000A_` soup, 16 Oct 2026).
 * Success is decided by what happened, not by `$?`, which after the capture only says the
 * assignment worked: no error records, and no native command exiting non-zero. Checked live
 * on the owner's VM: a missing service and `cmd /c exit 3` fail; a running service passes.
 */
export function powershellCheck(command: string, marker: string): string {
  return powershellRemote(
    [
      "$global:LASTEXITCODE = 0",
      `$fadiOut = @(& { ${command} } 2>&1)`,
      "$fadiOk = (@($fadiOut | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }).Count -eq 0) -and ($LASTEXITCODE -eq 0)",
      "$fadiOut | Out-String -Width 240",
      `if ($fadiOk) { Write-Output "${marker}=0" } else { Write-Output "${marker}=1" }`,
    ].join("; ")
  );
}
