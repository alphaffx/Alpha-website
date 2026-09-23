# ==============================================================
#  Alpha website - model folder watcher
#
#  Scans the "models" folder and rewrites models/models.json so
#  the website always shows whatever is actually in the folder.
#
#  Run it by double-clicking watch-models.bat. Leave the window
#  open while you work; close it when you are done.
#
#  Naming rule: a model is any <name>.glb file. If <name>.blend
#  sits beside it, the .blend download is offered too.
# ==============================================================

param([switch]$Once)

$ErrorActionPreference = 'Stop'

$Root      = $PSScriptRoot
$ModelsDir = Join-Path $Root 'models'
$Manifest  = Join-Path $ModelsDir 'models.json'

if (-not (Test-Path -LiteralPath $ModelsDir)) {
    Write-Host ""
    Write-Host "  Could not find a 'models' folder next to this script." -ForegroundColor Red
    Write-Host "  Expected: $ModelsDir" -ForegroundColor DarkGray
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}

# ---------- helpers ----------

function ConvertTo-JsonText([string]$s) {
    if ($null -eq $s) { return '' }
    return $s.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n').Replace("`t", '\t')
}

function Get-PrettyName([string]$id) {
    # adam            -> Adam
    # ice_dragon      -> Ice Dragon
    # my-cool-model   -> My Cool Model
    $words = ($id -replace '[-_]+', ' ') -split '\s+' | Where-Object { $_ -ne '' }
    if (-not $words) { return $id }
    $parts = foreach ($w in $words) { $w.Substring(0, 1).ToUpper() + $w.Substring(1) }
    return ($parts -join ' ')
}

function Get-HumanSize([long]$bytes) {
    if ($bytes -ge 1073741824) { return ('{0:N1} GB' -f ($bytes / 1073741824)) }
    if ($bytes -ge 1048576)    { return ('{0:N1} MB' -f ($bytes / 1048576)) }
    if ($bytes -ge 1024)       { return ('{0:N0} KB' -f ($bytes / 1024)) }
    return "$bytes B"
}

function Get-ExistingEntries {
    # Any name or kind you edited by hand in models.json is kept,
    # so renaming a model there is not undone on the next scan.
    $map = @{}
    if (Test-Path -LiteralPath $Manifest) {
        try {
            $old = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
            foreach ($m in $old.models) {
                if ($m -and $m.id) { $map[[string]$m.id] = $m }
            }
        } catch {
            Write-Host "  (existing models.json was unreadable, rebuilding from scratch)" -ForegroundColor DarkYellow
        }
    }
    return $map
}

function Write-Manifest {
    $previous = Get-ExistingEntries
    $rows     = New-Object System.Collections.ArrayList
    $count    = 0
    $noBlend  = New-Object System.Collections.ArrayList

    $glbFiles = Get-ChildItem -LiteralPath $ModelsDir -Filter '*.glb' -File | Sort-Object Name

    foreach ($glb in $glbFiles) {
        $id        = [System.IO.Path]::GetFileNameWithoutExtension($glb.Name)
        $blendPath = Join-Path $ModelsDir ($id + '.blend')
        $hasBlend  = Test-Path -LiteralPath $blendPath

        $name = if ($previous.ContainsKey($id) -and $previous[$id].name) { [string]$previous[$id].name } else { Get-PrettyName $id }
        $kind = if ($previous.ContainsKey($id) -and $previous[$id].kind) { [string]$previous[$id].kind } else { '3D model' }

        # New models are free. To make one premium, edit models.json and set
        # "tier":"paid" (and optionally "price":"$5") - the watcher keeps it.
        $tier  = if ($previous.ContainsKey($id) -and $previous[$id].tier)  { [string]$previous[$id].tier }  else { 'free' }
        $price = if ($previous.ContainsKey($id) -and $previous[$id].price) { [string]$previous[$id].price } else { '' }
        if ($tier -ne 'paid') { $tier = 'free' }

        $blendSize = ''
        if ($hasBlend) {
            $blendSize = Get-HumanSize (Get-Item -LiteralPath $blendPath).Length
        } else {
            [void]$noBlend.Add($id)
        }

        $row = '    {{"id":"{0}","name":"{1}","kind":"{2}","glb":"{3}","blend":"{4}","hasBlend":{5},"tier":"{6}","price":"{7}"}}' -f `
            (ConvertTo-JsonText $id),
            (ConvertTo-JsonText $name),
            (ConvertTo-JsonText $kind),
            (ConvertTo-JsonText (Get-HumanSize $glb.Length)),
            (ConvertTo-JsonText $blendSize),
            $(if ($hasBlend) { 'true' } else { 'false' }),
            (ConvertTo-JsonText $tier),
            (ConvertTo-JsonText $price)

        # Preserve verified compatibility and generated GLB facts between scans.
        if ($previous.ContainsKey($id)) {
            $entry = $row | ConvertFrom-Json
            foreach ($field in @('blenderCompatibility', 'glbDetails')) {
                if ($null -ne $previous[$id].$field) {
                    $entry | Add-Member -NotePropertyName $field -NotePropertyValue $previous[$id].$field
                }
            }
            $row = '    ' + ($entry | ConvertTo-Json -Depth 12 -Compress)
        }
        [void]$rows.Add($row)
        $count++
    }

    $stamp = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
    $body  = if ($rows.Count -gt 0) { ($rows -join ",`n") } else { '' }

    $json = "{`n" +
            "  ""generated"": ""$stamp"",`n" +
            "  ""models"": [`n" +
            $body +
            "`n  ]`n}`n"

    # UTF8 without BOM, so the browser's JSON parser is happy.
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Manifest, $json, $utf8)

    return [pscustomobject]@{ Count = $count; NoBlend = $noBlend }
}

# ---------- After Effects presets ----------

# Which files count as a preset (case-insensitive).
$PresetPattern = '\.(ffx|aep|zip|cube|lut)$'

function Write-PresetManifest {
    $dir = Join-Path $Root 'presets'
    if (-not (Test-Path -LiteralPath $dir)) { return -1 }

    $manifest = Join-Path $dir 'presets.json'

    # keep any name/desc you edited by hand
    $previous = @{}
    if (Test-Path -LiteralPath $manifest) {
        try {
            $old = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
            foreach ($p in $old.presets) { if ($p -and $p.file) { $previous[[string]$p.file] = $p } }
        } catch { }
    }

    $rows = New-Object System.Collections.ArrayList
    $files = Get-ChildItem -LiteralPath $dir -File |
             Where-Object { $_.Name -match $PresetPattern } |
             Sort-Object Name

    foreach ($f in $files) {
        $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
        $name = if ($previous.ContainsKey($f.Name) -and $previous[$f.Name].name) { [string]$previous[$f.Name].name } else { Get-PrettyName $base }
        $desc = if ($previous.ContainsKey($f.Name) -and $previous[$f.Name].desc) { [string]$previous[$f.Name].desc } else { '' }

        # Set "tier":"paid" (and optionally "price") in presets.json to move
        # a preset into the Store. The watcher keeps whatever you put there.
        $ptier  = if ($previous.ContainsKey($f.Name) -and $previous[$f.Name].tier)  { [string]$previous[$f.Name].tier }  else { 'free' }
        $pprice = if ($previous.ContainsKey($f.Name) -and $previous[$f.Name].price) { [string]$previous[$f.Name].price } else { '' }
        if ($ptier -ne 'paid') { $ptier = 'free' }

        $row = '    {{"file":"{0}","name":"{1}","desc":"{2}","size":"{3}","tier":"{4}","price":"{5}"}}' -f `
            (ConvertTo-JsonText $f.Name),
            (ConvertTo-JsonText $name),
            (ConvertTo-JsonText $desc),
            (ConvertTo-JsonText (Get-HumanSize $f.Length)),
            (ConvertTo-JsonText $ptier),
            (ConvertTo-JsonText $pprice)
        [void]$rows.Add($row)
    }

    $body = if ($rows.Count -gt 0) { ($rows -join ",`n") } else { '' }
    $json = "{`n" +
            "  ""generated"": ""$((Get-Date).ToString('yyyy-MM-ddTHH:mm:ss'))"",`n" +
            "  ""presets"": [`n" + $body + "`n  ]`n}`n"

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($manifest, $json, $utf8)
    return $files.Count
}

# ---------- Store product pictures ----------

# Pictures for a store product live in  media\store\<slug>\  where <slug>
# is the "slug" field of that product in store.json. Drop any number of
# pictures in and they become that product's slideshow, in filename order.
$StoreImagePattern = '\.(jpg|jpeg|png|webp|avif|gif)$'

function Write-StoreManifest {
    $manifest = Join-Path $Root 'store.json'
    if (-not (Test-Path -LiteralPath $manifest)) { return -1 }

    try { $data = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json } catch { return -1 }
    if (-not $data.items) { return -1 }

    $total = 0
    foreach ($it in $data.items) {
        if (-not $it.slug) { continue }
        $dir  = Join-Path (Join-Path $Root 'media\store') $it.slug
        $list = New-Object System.Collections.ArrayList
        if (Test-Path -LiteralPath $dir) {
            $files = Get-ChildItem -LiteralPath $dir -File |
                     Where-Object { $_.Name -match $StoreImagePattern } |
                     Sort-Object Name
            foreach ($f in $files) {
                [void]$list.Add('./media/store/' + $it.slug + '/' + $f.Name)
            }
        }
        # everything else in store.json (title, price, desc, url) is left alone
        $it.images = @($list.ToArray())
        $total += $list.Count
    }

    $json = $data | ConvertTo-Json -Depth 8
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($manifest, $json, $utf8)
    return $total
}

function Get-StoreSignature {
    $base = Join-Path $Root 'media\store'
    if (-not (Test-Path -LiteralPath $base)) { return 'none' }
    $files = Get-ChildItem -LiteralPath $base -File -Recurse |
             Where-Object { $_.Name -match $StoreImagePattern } |
             Sort-Object FullName
    $parts = foreach ($f in $files) { "$($f.FullName):$($f.Length)" }
    return ($parts -join '|')
}

function Get-PresetSignature {
    $dir = Join-Path $Root 'presets'
    if (-not (Test-Path -LiteralPath $dir)) { return 'none' }
    $files = Get-ChildItem -LiteralPath $dir -File |
             Where-Object { $_.Name -match $PresetPattern } |
             Sort-Object Name
    $parts = foreach ($f in $files) { "$($f.Name):$($f.Length)" }
    return ($parts -join '|')
}

function Get-FolderSignature {
    $files = Get-ChildItem -LiteralPath $ModelsDir -File |
             Where-Object { $_.Extension -eq '.glb' -or $_.Extension -eq '.blend' } |
             Sort-Object Name
    $parts = foreach ($f in $files) { "$($f.Name):$($f.Length):$($f.LastWriteTimeUtc.Ticks)" }
    return ($parts -join '|')
}

function Get-PreviewSignature {
    $dir = Join-Path $Root 'media\models'
    if (-not (Test-Path -LiteralPath $dir)) { return 'none' }
    $parts = Get-ChildItem -LiteralPath $dir -Filter '*.webp' -File | Sort-Object Name | ForEach-Object { "$($_.Name):$($_.Length):$($_.LastWriteTimeUtc.Ticks)" }
    return ($parts -join '|')
}

function Update-Previews {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
    if (-not (Test-Path -LiteralPath $nodePath)) {
        Write-Host '  Preview generation needs Node.js. Install Node.js, then restart the watcher.' -ForegroundColor Yellow
        return $false
    }
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $nodePath (Join-Path $Root 'generate-previews.cjs') 2>&1 | ForEach-Object { Write-Host "            $_" }
        $succeeded = ($LASTEXITCODE -eq 0)
    } finally { $ErrorActionPreference = $previousErrorAction }
    return $succeeded
}

# ---------- run ----------

Clear-Host
Write-Host ""
Write-Host "  ALPHA - model watcher" -ForegroundColor Cyan
Write-Host "  ---------------------" -ForegroundColor DarkCyan
Write-Host "  Watching: $ModelsDir" -ForegroundColor DarkGray
Write-Host "  Drop a .glb (and its .blend) in that folder and the" -ForegroundColor DarkGray
Write-Host "  website picks it up within a few seconds." -ForegroundColor DarkGray
Write-Host "  Preview images are generated automatically. Refresh your local" -ForegroundColor DarkGray
Write-Host "  page afterwards; commit and sync to update the live website." -ForegroundColor DarkGray
Write-Host "  Close this window to stop." -ForegroundColor DarkGray
Write-Host ""

$lastSignature = ''
$lastPreviewSignature = ''
$previewRetryAt = [datetime]::MinValue
$previewPending = $true

while ($true) {
    try {
        $signature = (Get-FolderSignature) + '##' + (Get-PresetSignature) + '##' + (Get-StoreSignature)

        if ($signature -ne $lastSignature) {
            # Avoid cataloging half-copied exports. The renderer also validates GLB length.
            Start-Sleep -Seconds 2
            $settled = (Get-FolderSignature) + '##' + (Get-PresetSignature) + '##' + (Get-StoreSignature)
            if ($signature -ne $settled) { continue }
            $result = Write-Manifest
            $lastSignature = $signature
            $previewPending = $true
            $time = Get-Date -Format 'HH:mm:ss'

            Write-Host ("  [{0}] models.json updated - {1} model(s)" -f $time, $result.Count) -ForegroundColor Green

            $presetCount = Write-PresetManifest
            if ($presetCount -ge 0) {
                Write-Host ("            presets.json updated - {0} preset(s)" -f $presetCount) -ForegroundColor Green
            }

            $shotCount = Write-StoreManifest
            if ($shotCount -ge 0) {
                Write-Host ("            store.json updated - {0} product picture(s)" -f $shotCount) -ForegroundColor Green
            }

            foreach ($id in $result.NoBlend) {
                Write-Host ("            note: {0}.glb has no matching {0}.blend" -f $id) -ForegroundColor DarkYellow
            }
        }
        if ((Get-PreviewSignature) -ne $lastPreviewSignature) { $previewPending = $true }
        if ($previewPending -and (Get-Date) -ge $previewRetryAt) {
            $previewPending = -not (Update-Previews)
            $lastPreviewSignature = Get-PreviewSignature
            $previewRetryAt = (Get-Date).AddSeconds(30)
            if ($previewPending) { Write-Host '            Will retry previews in 30 seconds.' -ForegroundColor Yellow }
        }
    } catch {
        Write-Host ("  [{0}] error: {1}" -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor Red
        $previewPending = $true
        $previewRetryAt = (Get-Date).AddSeconds(30)
    }

    if ($Once) { if ($previewPending) { exit 1 } else { exit 0 } }
    Start-Sleep -Seconds 2
}
