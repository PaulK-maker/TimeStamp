# Stripe CLI Installation Script for Windows
# Run this from PowerShell as Administrator

$ProgressPreference = 'SilentlyContinue'

Write-Host "Downloading Stripe CLI..." -ForegroundColor Green

function Add-ToUserPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathToAdd
    )

    $currentUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathEntries = @()

    if ($currentUserPath) {
        $pathEntries = $currentUserPath.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries)
    }

    if ($pathEntries -contains $PathToAdd) {
        return $false
    }

    $newUserPath = if ($currentUserPath) {
        "$currentUserPath;$PathToAdd"
    }
    else {
        $PathToAdd
    }

    [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
    return $true
}

# Download configuration
$url = 'https://github.com/stripe/stripe-cli/releases/download/v1.37.8/stripe_1.37.8_windows_x86_64.zip'
$downloadPath = "$env:USERPROFILE\Downloads\stripe-cli.zip"
$extractPath = "$env:USERPROFILE\stripe-cli"

try {
    # Download the file
    Write-Host "Downloading from: $url"
    Invoke-WebRequest -Uri $url -OutFile $downloadPath -UseBasicParsing
    Write-Host "Downloaded to: $downloadPath" -ForegroundColor Green

    # Create extraction directory
    if (-not (Test-Path $extractPath)) {
        New-Item -ItemType Directory -Path $extractPath -Force | Out-Null
    }

    # Extract the ZIP file
    Write-Host "Extracting..." -ForegroundColor Green
    Expand-Archive -Path $downloadPath -DestinationPath $extractPath -Force
    Write-Host "Extracted to: $extractPath" -ForegroundColor Green

    # Verify the executable exists
    $stripePath = Join-Path $extractPath 'stripe.exe'
    if (Test-Path $stripePath) {
        Write-Host "Stripe executable found!" -ForegroundColor Green
        & $stripePath --version

        # Add to PATH for current session
        $env:PATH = "$extractPath;$env:PATH"

        # Persist PATH for new terminals and future VS Code sessions
        $pathWasUpdated = Add-ToUserPath -PathToAdd $extractPath

        Write-Host "`nStripe CLI has been installed successfully!" -ForegroundColor Green
        if ($pathWasUpdated) {
            Write-Host "Added $extractPath to your user PATH." -ForegroundColor Green
        }
        else {
            Write-Host "$extractPath is already in your user PATH." -ForegroundColor Yellow
        }
        Write-Host "Restart VS Code before running stripe in the integrated terminal so new shells inherit the updated PATH." -ForegroundColor Yellow
        Write-Host "Until then, you can run it directly with: $stripePath --version" -ForegroundColor Yellow
        Write-Host "`nNext steps:" -ForegroundColor Yellow
        Write-Host "1. Authenticate: stripe login"
        Write-Host "2. Forward webhooks: stripe listen --forward-to localhost:5001/api/stripe/webhook"
        Write-Host "3. Copy the webhook secret to STRIPE_WEBHOOK_SECRET in /backend/.env"
        Write-Host "4. Restart your backend server"
    }
    else {
        Write-Host "ERROR: stripe.exe not found after extraction" -ForegroundColor Red
    }

    # Clean up downloaded ZIP
    Remove-Item $downloadPath -Force -ErrorAction SilentlyContinue

} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "`nFallback: Visit https://github.com/stripe/stripe-cli/releases" -ForegroundColor Yellow
    Write-Host "Download stripe_1.37.8_windows_x86_64.zip manually"
}
