<#
.SYNOPSIS
    Đấu nối API chia sẻ GameLab vào CloudFront distribution (gamelab.ohstem.vn).

.DESCRIPTION
    Tự động làm 3 việc:
      1. Tạo/cập nhật + publish CloudFront Function rewrite URL chia sẻ
         (/_id -> /#pub:_id, và /static/* -> /docs/static/*).
      2. Thêm Origin trỏ về API Gateway + Cache Behavior "/api/*"
         (CachingDisabled, AllViewerExceptHostHeader, mọi HTTP method).
      3. Gắn function vào Default behavior (viewer-request) và tạo invalidation.

    MẶC ĐỊNH chạy ở chế độ DRY-RUN: chỉ in ra những gì SẼ thay đổi và ghi
    config đề xuất ra file để bạn xem, KHÔNG đụng vào distribution thật.
    Thêm -Apply để thực thi.

.EXAMPLE
    # Xem trước (an toàn, không thay đổi gì)
    ./setup-cloudfront.ps1

.EXAMPLE
    # Thực thi thật
    ./setup-cloudfront.ps1 -Apply
#>

[CmdletBinding()]
param(
    [string]$DistributionId = "E26OB3OVA7KBC6",
    [string]$ApiDomain      = "14ucsjuv36.execute-api.ap-southeast-1.amazonaws.com",
    [string]$OriginPath     = "/prod",
    [string]$OriginId       = "share-api",
    [string]$FunctionName   = "gamelab-rewrite-static-path",
    [string]$Profile        = "ohstem",
    [string]$FunctionCodePath = "",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

# Thư mục chứa script (fallback nếu $PSScriptRoot rỗng).
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $FunctionCodePath) { $FunctionCodePath = Join-Path $ScriptDir "rewrite-share-url.js" }

# AWS-managed policy IDs (cố định toàn cầu)
$CACHE_DISABLED_ID     = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # CachingDisabled
$ALL_VIEWER_NO_HOST_ID = "b689b0a8-53d0-40ab-baf2-68738e2966ac"  # AllViewerExceptHostHeader

function Invoke-Aws {
    param([Parameter(ValueFromRemainingArguments)] [string[]]$Args)
    $out = & aws --profile $Profile @Args
    if ($LASTEXITCODE -ne 0) { throw "aws $($Args -join ' ') -> exit $LASTEXITCODE`n$out" }
    return $out
}

function Write-JsonNoBom {
    param([string]$Path, [object]$Object)
    $json = $Object | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
}

$mode = if ($Apply) { "APPLY" } else { "DRY-RUN" }
Write-Host "=== Setup CloudFront cho share API  [$mode] ===" -ForegroundColor Cyan
Write-Host "Distribution: $DistributionId   API: $ApiDomain$OriginPath`n"

if (-not (Test-Path $FunctionCodePath)) { throw "Không thấy file function: $FunctionCodePath" }

# ---------------------------------------------------------------------------
# BƯỚC 1: CloudFront Function
# ---------------------------------------------------------------------------
Write-Host "[1/4] CloudFront Function '$FunctionName'..." -ForegroundColor Yellow
$funcArn = $null
$exists = $true
try { $desc = Invoke-Aws cloudfront describe-function --name $FunctionName | ConvertFrom-Json }
catch { $exists = $false }

if (-not $Apply) {
    if ($exists) {
        $funcArn = $desc.FunctionSummary.FunctionMetadata.FunctionARN
        Write-Host "    SẼ: cập nhật code + publish (function đã tồn tại)."
        Write-Host "    ARN: $funcArn"
    } else {
        Write-Host "    SẼ: tạo mới function với runtime cloudfront-js-2.0 + publish."
        $funcArn = "arn:aws:cloudfront::<account>:function/$FunctionName  (sẽ có sau khi tạo)"
    }
} else {
    if ($exists) {
        $etag = $desc.ETag
        Write-Host "    Cập nhật code function (ETag $etag)..."
        $upd = Invoke-Aws cloudfront update-function --name $FunctionName --if-match $etag `
            --function-config "Comment=GameLab share URL rewrite,Runtime=cloudfront-js-2.0" `
            --function-code "fileb://$FunctionCodePath" | ConvertFrom-Json
        $etag = $upd.ETag
    } else {
        Write-Host "    Tạo mới function..."
        $crt = Invoke-Aws cloudfront create-function --name $FunctionName `
            --function-config "Comment=GameLab share URL rewrite,Runtime=cloudfront-js-2.0" `
            --function-code "fileb://$FunctionCodePath" | ConvertFrom-Json
        $etag = $crt.ETag
    }
    Write-Host "    Publish function (ETag $etag)..."
    $pub = Invoke-Aws cloudfront publish-function --name $FunctionName --if-match $etag | ConvertFrom-Json
    $funcArn = $pub.FunctionSummary.FunctionMetadata.FunctionARN
    Write-Host "    ✔ Published. ARN: $funcArn" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# BƯỚC 2: Lấy distribution config hiện tại
# ---------------------------------------------------------------------------
Write-Host "`n[2/4] Đọc distribution config..." -ForegroundColor Yellow
$cfgWrap = Invoke-Aws cloudfront get-distribution-config --id $DistributionId | ConvertFrom-Json
$etagDist = $cfgWrap.ETag
$cfg = $cfgWrap.DistributionConfig
Write-Host "    ETag: $etagDist"

# --- Origin /api ---
$originExists = @($cfg.Origins.Items | Where-Object { $_.Id -eq $OriginId }).Count -gt 0
if ($originExists) {
    Write-Host "    Origin '$OriginId' đã tồn tại -> giữ nguyên."
} else {
    Write-Host "    + Thêm Origin '$OriginId' -> $ApiDomain$OriginPath"
    $newOrigin = @"
{
  "Id": "$OriginId",
  "DomainName": "$ApiDomain",
  "OriginPath": "$OriginPath",
  "CustomHeaders": { "Quantity": 0 },
  "CustomOriginConfig": {
    "HTTPPort": 80,
    "HTTPSPort": 443,
    "OriginProtocolPolicy": "https-only",
    "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
    "OriginReadTimeout": 30,
    "OriginKeepaliveTimeout": 5
  },
  "ConnectionAttempts": 3,
  "ConnectionTimeout": 10,
  "OriginShield": { "Enabled": false }
}
"@ | ConvertFrom-Json
    $cfg.Origins.Items = @($cfg.Origins.Items) + $newOrigin
    $cfg.Origins.Quantity = $cfg.Origins.Items.Count
}

# --- Cache behavior /api/* ---
$behItems = if ($cfg.CacheBehaviors.Items) { @($cfg.CacheBehaviors.Items) } else { @() }
$apiExists = @($behItems | Where-Object { $_.PathPattern -eq "/api/*" }).Count -gt 0
if ($apiExists) {
    Write-Host "    Behavior '/api/*' đã tồn tại -> giữ nguyên."
} else {
    Write-Host "    + Thêm Behavior '/api/*' -> origin '$OriginId' (CachingDisabled)"
    $newBeh = @"
{
  "PathPattern": "/api/*",
  "TargetOriginId": "$OriginId",
  "ViewerProtocolPolicy": "redirect-to-https",
  "AllowedMethods": {
    "Quantity": 7,
    "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
    "CachedMethods": { "Quantity": 2, "Items": ["GET","HEAD"] }
  },
  "Compress": true,
  "SmoothStreaming": false,
  "FieldLevelEncryptionId": "",
  "CachePolicyId": "$CACHE_DISABLED_ID",
  "OriginRequestPolicyId": "$ALL_VIEWER_NO_HOST_ID",
  "LambdaFunctionAssociations": { "Quantity": 0 },
  "FunctionAssociations": { "Quantity": 0 }
}
"@ | ConvertFrom-Json
    # /api/* phải đứng TRƯỚC các behavior rộng hơn -> prepend
    $behItems = @($newBeh) + $behItems
    if (-not $cfg.CacheBehaviors) {
        $cfg | Add-Member -Force -NotePropertyName CacheBehaviors -NotePropertyValue ([pscustomobject]@{})
    }
    $cfg.CacheBehaviors | Add-Member -Force -NotePropertyName Items -NotePropertyValue $behItems
    $cfg.CacheBehaviors | Add-Member -Force -NotePropertyName Quantity -NotePropertyValue $behItems.Count
}

# --- Function association trên Default behavior ---
$dcb = $cfg.DefaultCacheBehavior
$fa = $dcb.FunctionAssociations
$attachFunc = $true
if ($fa -and $fa.Quantity -gt 0) {
    $current = @($fa.Items | Where-Object { $_.EventType -eq "viewer-request" })
    if ($current.Count -gt 0) {
        $curArn = $current[0].FunctionARN
        if ($curArn -eq $funcArn) {
            Write-Host "    Function đã gắn vào Default (viewer-request) -> giữ nguyên."
            $attachFunc = $false
        } else {
            Write-Host "    ! CẢNH BÁO: Default behavior đã có function viewer-request khác:" -ForegroundColor Red
            Write-Host "      $curArn" -ForegroundColor Red
            Write-Host "      CloudFront chỉ cho 1 function/viewer-request. Script sẽ THAY THẾ nó." -ForegroundColor Red
            Write-Host "      Nếu function cũ cũng cần thiết, hãy gộp logic vào rewrite-share-url.js trước." -ForegroundColor Red
        }
    }
}
if ($attachFunc) {
    Write-Host "    + Gắn function vào Default behavior (viewer-request)"
    $assoc = [pscustomobject]@{
        Quantity = 1
        Items    = @([pscustomobject]@{ FunctionARN = $funcArn; EventType = "viewer-request" })
    }
    $dcb | Add-Member -Force -NotePropertyName FunctionAssociations -NotePropertyValue $assoc
}

# ---------------------------------------------------------------------------
# BƯỚC 3: Áp dụng (hoặc ghi file dry-run)
# ---------------------------------------------------------------------------
$outFile = Join-Path $ScriptDir "distribution-config.proposed.json"
Write-JsonNoBom -Path $outFile -Object $cfg

Write-Host "`n[3/4] Cập nhật distribution..." -ForegroundColor Yellow
if (-not $Apply) {
    Write-Host "    DRY-RUN: đã ghi config đề xuất ra:" -ForegroundColor Cyan
    Write-Host "      $outFile"
    Write-Host "    Xem lại rồi chạy lại với -Apply để thực thi."
} else {
    Invoke-Aws cloudfront update-distribution --id $DistributionId --if-match $etagDist `
        --distribution-config "file://$outFile" | Out-Null
    Write-Host "    ✔ Distribution đã cập nhật." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# BƯỚC 4: Invalidation
# ---------------------------------------------------------------------------
Write-Host "`n[4/4] Invalidation /*..." -ForegroundColor Yellow
if (-not $Apply) {
    Write-Host "    DRY-RUN: sẽ tạo invalidation '/*'."
} else {
    $inv = Invoke-Aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" | ConvertFrom-Json
    Write-Host "    ✔ Invalidation: $($inv.Invalidation.Id)" -ForegroundColor Green
}

Write-Host "`n=== Hoàn tất [$mode] ===" -ForegroundColor Cyan
if (-not $Apply) {
    Write-Host "Chạy lại để thực thi:  ./setup-cloudfront.ps1 -Apply" -ForegroundColor Green
} else {
    Write-Host "CloudFront đang triển khai (vài phút). Sau đó kiểm tra:" -ForegroundColor Green
    Write-Host "  curl -i https://gamelab.ohstem.vn/api/<id>        # 200 + JSON"
    Write-Host "  mở https://gamelab.ohstem.vn/_<id>                # redirect -> #pub:"
}
