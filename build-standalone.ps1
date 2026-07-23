# build-standalone.ps1 — junta CSS + JS num HTML único.
# Gera dois arquivos:
#   folha-certa-standalone.html  -> HTML completo (abrir direto / hospedar no Firebase)
#   folha-certa-artifact.html    -> só o conteúdo do body (para publicar como página)
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object System.Text.UTF8Encoding($false)
$nl = "`n"

$css    = [System.IO.File]::ReadAllText((Join-Path $dir 'assets\styles.css'))
$db     = [System.IO.File]::ReadAllText((Join-Path $dir 'js\db.js'))
$schema = [System.IO.File]::ReadAllText((Join-Path $dir 'js\schema.js'))
$audit  = [System.IO.File]::ReadAllText((Join-Path $dir 'js\audit.js'))
$ia     = [System.IO.File]::ReadAllText((Join-Path $dir 'js\ia.js'))
$convert = [System.IO.File]::ReadAllText((Join-Path $dir 'js\convert.js'))
$app    = [System.IO.File]::ReadAllText((Join-Path $dir 'js\app.js'))

$body = @'
<header class="topbar">
  <button class="iconbtn" id="menuBtn" aria-label="Menu">&#9776;</button>
  <div class="brand"><span class="logo">FC</span><div>Folha Certa<small>Conferencia por convencao</small></div></div>
  <span class="spacer"></span>
</header>
<main id="app"></main>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer">
  <div class="dh"><b>Folha Certa</b><br><small>Totali Contabilidade</small></div>
  <nav id="drawerNav"></nav>
  <div style="margin-top:auto;padding:12px;border-top:1px solid var(--line)">
    <button class="btn ghost block sm" data-config style="margin-bottom:8px">&#9881; Configuracoes</button>
    <button class="btn ghost block sm" data-export>&#10548; Exportar backup (JSON)</button>
    <div class="mini" id="appVersion" style="text-align:center;margin-top:10px;opacity:.65"></div>
  </div>
</aside>
<nav class="bottomnav" id="bottomnav"></nav>
<div class="modal-scrim" id="modalScrim"><div class="modal" id="modalBody"></div></div>
<div class="toast" id="toast"></div>
'@

$styleTag = '<style>' + $nl + $css + $nl + '</style>'
$scripts = '<script>' + $nl + $db + $nl + '</script>' + $nl +
           '<script>' + $nl + $schema + $nl + '</script>' + $nl +
           '<script>' + $nl + $audit + $nl + '</script>' + $nl +
           '<script>' + $nl + $ia + $nl + '</script>' + $nl +
           '<script>' + $nl + $convert + $nl + '</script>' + $nl +
           '<script>' + $nl + $app + $nl + '</script>'

# --- Standalone completo ---
$head = '<!DOCTYPE html>' + $nl +
        '<html lang="pt-BR"><head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">' +
        '<meta name="theme-color" content="#0B2140">' +
        '<title>Folha Certa</title>' + $nl + $styleTag + $nl + '</head><body>' + $nl
$tail = $nl + '</body></html>'
$standalone = $head + $body + $nl + $scripts + $tail
[System.IO.File]::WriteAllText((Join-Path $dir 'folha-certa-standalone.html'), $standalone, $utf8)

# --- Artifact (so o conteudo, sem doctype/html/head/body) ---
$artifact = $styleTag + $nl + $body + $nl + $scripts
[System.IO.File]::WriteAllText((Join-Path $dir 'folha-certa-artifact.html'), $artifact, $utf8)

Write-Output ("standalone: {0:N0} bytes" -f (Get-Item (Join-Path $dir 'folha-certa-standalone.html')).Length)
Write-Output ("artifact:   {0:N0} bytes" -f (Get-Item (Join-Path $dir 'folha-certa-artifact.html')).Length)
