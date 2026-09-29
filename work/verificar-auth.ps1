# Verificacion del prompt 4b (auth.html) con curl, no con el fetch de node:
# el http.server de python es monohilo y undici se cuelga al reutilizar
# conexiones keep-alive (assert(!this.paused) en Parser.finish).
# Uso: verificar-auth.ps1 <url-base>

$BASE = if ($args[0]) { $args[0] } else { "http://localhost:8829" }
$RAIZ = if ($args[1]) { $args[1] } else { "." }
$fallos = 0; $checks = 0

function ok($m)   { $script:checks++; Write-Host "  PASA  $m" }
function fail($m) { $script:checks++; $script:fallos++; Write-Host "  FALLA $m" }

function status($url) {
    $code = curl.exe -s -o NUL -w "%{http_code}" --max-time 10 $url
    if (-not $code) { return "000" }
    return $code
}

Write-Host "`n== 1. recursos que carga auth.html =="
$html = Get-Content "$RAIZ\auth.html" -Raw
[regex]::Matches($html, '(?:href|src)="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } |
    Where-Object { $_ -notmatch '^https?://' } | ForEach-Object {
        $code = status "$BASE/$_"
        if ($code -eq "200") { ok "$_ -> 200" } else { fail "$_ -> $code" }
    }

Write-Host "`n== 2. imagen del hero, tal y como la resuelve el CSS =="
$css = Get-Content "$RAIZ\css\pages\auth.css" -Raw
$bg = [regex]::Match($css, 'url\("([^"]+login\.avif)"\)')
if (-not $bg.Success) {
    fail "auth.css no referencia login.avif"
} else {
    # auth.css vive en css/pages/: ../img resolveria a css/img/ -> 404
    $rel = $bg.Groups[1].Value
    $esperado = if ($rel.StartsWith("../../")) { "/img/avif/login.avif" } else { "/css/img/avif/login.avif" }
    $code = status "$BASE$esperado"
    if ($code -eq "200") { ok "$rel -> 200 (resuelve a $esperado)" }
    else { fail "$rel -> $code  se resuelve a $esperado" }
}

Write-Host "`n== 3. manifest sin icons y bien formado =="
$man = curl.exe -s --max-time 10 "$BASE/manifest.webmanifest" | ConvertFrom-Json
if ($man.icons) { fail "el manifest todavia tiene el array icons" }
else { ok "manifest sin icons ($(@($man.PSObject.Properties).Count) claves, JSON valido)" }

Write-Host "`n== 4. las 2 vistas de auth existen con sus ids =="
$necesarios = @{
  "login"    = @("login-form","login-email","login-password","login-error","login-enviar","#/register")
  "register" = @("register-form","register-nombre","register-email","register-password","register-confirm","register-error","register-enviar","#/login")
}
foreach ($v in $necesarios.Keys) {
    $code = status "$BASE/views/auth/$v.html"
    if ($code -ne "200") { fail "views/auth/$v.html -> $code"; continue }
    $cuerpo = (curl.exe -s --max-time 10 "$BASE/views/auth/$v.html") -join "`n"
    $faltan = @($necesarios[$v] | Where-Object { -not $cuerpo.Contains($_) })
    if ($faltan.Count) { fail "views/auth/$v.html le faltan: $($faltan -join ', ')" }
    else { ok "views/auth/$v.html con sus $($necesarios[$v].Count) referencias" }
}

Write-Host "`n== 5. modulos de la vista cargan sin 404 =="
foreach ($m in @("js/views/auth/login.js","js/views/auth/register.js","js/controllers/auth.js","js/components/Loading.js","js/utils/notify.js","js/services/authService.js")) {
    $code = status "$BASE/$m"
    if ($code -eq "200") { ok $m } else { fail "$m -> $code" }
}

Write-Host "`n== 6. estilos viejos de login.html siguen en auth.css =="
$cssViejo = Get-Content "$RAIZ\css\pages\auth.css" -Raw
foreach ($s in @(".block-login",".ipt input",".btns button","#btn-login",".registro-link a",".error.act")) {
    if ($cssViejo.Contains($s)) { ok "$s intacto" } else { fail "$s desaparecio" }
}

if ($fallos -eq 0) { Write-Host "`nVEREDICTO: TODO OK  ($checks checks)" }
else { Write-Host "`nVEREDICTO: $fallos FALLO(S)  ($checks checks)" }
exit $fallos
