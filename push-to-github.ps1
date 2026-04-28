# GroupTab - Push to GitHub
# Run this script once to set up git and push to GitHub

$ErrorActionPreference = "Stop"

Write-Host "GroupTab GitHub Setup" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

# Ask for GitHub username
$username = Read-Host "Enter your GitHub username"
$repoName = "grouptab"

# Configure git identity
git config user.email "lenhutkhangvo@gmail.com"
git config user.name $username

# Initialize git if not already done
if (-not (Test-Path ".git")) {
    git init
    git branch -M main
    Write-Host "Git initialized" -ForegroundColor Green
} else {
    Write-Host "Git already initialized" -ForegroundColor Yellow
}

# Create .gitignore if it doesn't exist
if (-not (Test-Path ".gitignore")) {
    @"
node_modules/
.next/
.env.local
.env
*.tsbuildinfo
"@ | Out-File -Encoding utf8 .gitignore
}

# Stage and commit everything
git add -A
git commit -m "Initial commit: GroupTab full-stack app" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing new to commit (or already committed)" -ForegroundColor Yellow
}

# Create GitHub repo via API (will prompt for token)
Write-Host ""
Write-Host "Creating GitHub repository..." -ForegroundColor Cyan
Write-Host "If prompted, enter your GitHub Personal Access Token"
Write-Host "(Generate one at: https://github.com/settings/tokens/new?scopes=repo)"
Write-Host ""

$token = Read-Host "GitHub Personal Access Token (or press Enter to skip repo creation)"

if ($token -ne "") {
    $headers = @{
        Authorization = "token $token"
        Accept = "application/vnd.github.v3+json"
    }
    $body = @{
        name = $repoName
        private = $false
        description = "Messenger-style group spending tracker with OCR receipt scanning"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Headers $headers -Body $body -ContentType "application/json"
        $repoUrl = $response.clone_url
        Write-Host "Repository created: $repoUrl" -ForegroundColor Green
    } catch {
        Write-Host "Repo may already exist, trying to use existing..." -ForegroundColor Yellow
        $userInfo = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers
        $username = $userInfo.login
        $repoUrl = "https://github.com/$username/$repoName.git"
    }

    # Add remote and push
    git remote remove origin 2>$null
    git remote add origin $repoUrl
    git push -u origin main

    Write-Host ""
    Write-Host "SUCCESS! Code pushed to: $repoUrl" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step: Deploy to Vercel" -ForegroundColor Cyan
    Write-Host "Run: npx vercel" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Skipped GitHub push. You can push manually with:" -ForegroundColor Yellow
    Write-Host "  git remote add origin https://github.com/YOUR_USERNAME/grouptab.git"
    Write-Host "  git push -u origin main"
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
