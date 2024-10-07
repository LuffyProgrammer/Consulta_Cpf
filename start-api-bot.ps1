# Caminho para os scripts
$apiScriptPath = "api.js"
$botScriptPath = "bot.py"

# Função para iniciar os scripts
function Start-Scripts {
    Write-Host "Iniciando scripts..."

    # Iniciar o script da API
    Start-Process -FilePath "node" -ArgumentList $apiScriptPath -NoNewWindow
    Write-Host "API iniciada."

    # Iniciar o script do Bot
    Start-Process -FilePath "python" -ArgumentList $botScriptPath -NoNewWindow
    Write-Host "Bot iniciado."
}

# Iniciar os scripts
Start-Scripts
