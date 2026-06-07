param(
  [ValidateSet("site", "api", "marketing", "all")]
  [string]$Target = "site",
  [string]$HostName = "2.24.104.195",
  [string]$UserName = "root",
  [int]$Port = 22
)

$ErrorActionPreference = "Stop"
$Repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Import-Module Posh-SSH -ErrorAction Stop

function New-DeployCredential {
  if ($env:HOSTINGER_PASSWORD) {
    $sec = ConvertTo-SecureString $env:HOSTINGER_PASSWORD -AsPlainText -Force
    return [System.Management.Automation.PSCredential]::new($UserName, $sec)
  }
  return Get-Credential -UserName $UserName -Message "Senha SSH da Hostinger"
}

function Invoke-Remote($Session, [string]$Command) {
  $result = Invoke-SSHCommand -SessionId $Session.SessionId -Command $Command -TimeOut 180
  if ($result.ExitStatus -ne 0) {
    throw (($result.Error + $result.Output) -join "`n")
  }
  if ($result.Output) { $result.Output -join "`n" | Write-Host }
}

function Send-Package($SftpSession, [string]$SourceDir, [string]$Name) {
  $pkg = Join-Path $env:TEMP "$Name-$Stamp.tgz"
  if (Test-Path $pkg) { Remove-Item $pkg -Force }
  tar -czf $pkg -C $SourceDir .
  $remote = "/tmp/$Name-$Stamp.tgz"
  Set-SFTPItem -SessionId $SftpSession.SessionId -Path $pkg -Destination "/tmp" -Force | Out-Null
  Remove-Item $pkg -Force
  return $remote
}

function Deploy-App($Ssh, $Sftp, [string]$Name, [string]$SourceDir, [string]$RemoteDir, [string]$AfterCommand, [string]$RsyncExclude = "") {
  if (-not (Test-Path $SourceDir)) { throw "Diretorio nao encontrado: $SourceDir" }
  Write-Host "Empacotando $Name..."
  $remotePkg = Send-Package $Sftp $SourceDir $Name
  $tmpDir = "/tmp/$Name-$Stamp"
  $backupDir = "$RemoteDir.backup-$Stamp"

  $cmd = @"
set -e
mkdir -p '$tmpDir'
tar -xzf '$remotePkg' -C '$tmpDir'
if [ -d '$RemoteDir' ]; then cp -a '$RemoteDir' '$backupDir'; fi
mkdir -p '$RemoteDir'
rsync -a --delete $RsyncExclude '$tmpDir/' '$RemoteDir/'
rm -rf '$tmpDir' '$remotePkg'
$AfterCommand
echo 'Deploy $Name concluido. Backup: $backupDir'
"@
  Invoke-Remote $Ssh $cmd
}

$cred = New-DeployCredential
$ssh = New-SSHSession -ComputerName $HostName -Port $Port -Credential $cred -AcceptKey
$sftp = New-SFTPSession -ComputerName $HostName -Port $Port -Credential $cred -AcceptKey

try {
  if ($Target -in @("site", "all")) {
    Deploy-App $ssh $sftp "noseutempo-site" `
      (Join-Path $Repo "apps/site") `
      "/home/user_1/htdocs/noseutempo.app" `
      "true"
  }

  if ($Target -in @("api", "all")) {
    Deploy-App $ssh $sftp "noseutempo-api" `
      (Join-Path $Repo "apps/api") `
      "/home/noseutempo-api/htdocs/api.noseutempo.app" `
      "cd /home/noseutempo-api/htdocs/api.noseutempo.app && npm install --omit=dev && pm2 reload noseutempo-api" `
      "--exclude='.env' --exclude='data/' --exclude='node_modules/'"
  }

  if ($Target -in @("marketing", "all")) {
    Deploy-App $ssh $sftp "noseutempo-marketing-engine" `
      (Join-Path $Repo "apps/marketing-engine") `
      "/var/www/nomeutempo-marketing-engine" `
      "cd /var/www/nomeutempo-marketing-engine && npm install && npm run build && pm2 reload marketing-engine" `
      "--exclude='.env' --exclude='node_modules/' --exclude='dist/'"
  }
}
finally {
  if ($sftp) { Remove-SFTPSession -SessionId $sftp.SessionId | Out-Null }
  if ($ssh) { Remove-SSHSession -SessionId $ssh.SessionId | Out-Null }
}
