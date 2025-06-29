# PowerShell script to deploy SMTP server to apollo.arcator.co.uk

Write-Host "Deploying SMTP server to apollo.arcator.co.uk..." -ForegroundColor Green

# Function to execute SSH command with passphrase
function Invoke-SSHCommand {
    param(
        [string]$Command,
        [string]$Passphrase = "Lemons1!"
    )
    
    $sshCommand = "echo '$Passphrase' | ssh -p 220 -i apollo_key mcsa@apollo.arcator.co.uk '$Command'"
    Write-Host "Executing: $Command" -ForegroundColor Yellow
    Invoke-Expression $sshCommand
}

# Function to upload file via SCP
function Invoke-SCPUpload {
    param(
        [string]$LocalFile,
        [string]$RemotePath,
        [string]$Passphrase = "Lemons1!"
    )
    
    $scpCommand = "echo '$Passphrase' | scp -P 220 -i apollo_key '$LocalFile' mcsa@apollo.arcator.co.uk:'$RemotePath'"
    Write-Host "Uploading $LocalFile to $RemotePath" -ForegroundColor Yellow
    Invoke-Expression $scpCommand
}

try {
    # Upload the setup script
    Write-Host "Uploading setup script..." -ForegroundColor Cyan
    Invoke-SCPUpload -LocalFile "setup-smtp-apollo.sh" -RemotePath "~/setup-smtp-apollo.sh"
    
    # Make the script executable and run it
    Write-Host "Making script executable..." -ForegroundColor Cyan
    Invoke-SSHCommand "chmod +x ~/setup-smtp-apollo.sh"
    
    Write-Host "Running setup script..." -ForegroundColor Cyan
    Invoke-SSHCommand "~/setup-smtp-apollo.sh"
    
    # Check if the service is running
    Write-Host "Checking service status..." -ForegroundColor Cyan
    Invoke-SSHCommand "sudo systemctl status arcator-smtp --no-pager"
    
    # Test the health endpoint
    Write-Host "Testing health endpoint..." -ForegroundColor Cyan
    Invoke-SSHCommand "curl -s http://localhost:3001/health | jq ."
    
    Write-Host "SMTP server deployment completed successfully!" -ForegroundColor Green
    Write-Host "The SMTP server is now running on apollo.arcator.co.uk:3001" -ForegroundColor Green
    Write-Host "To configure SMTP credentials, SSH to the server and edit ~/smtp-server/.env" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error during deployment: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 