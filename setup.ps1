# Função para gerar uma string aleatória
function Generate-RandomString {
    param (
        [int]$length = 32
    )
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    $result = -join ((0..($length-1)) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $result
}

# Gerar chaves aleatórias
$API_KEY = Generate-RandomString
$SECRET_KEY = Generate-RandomString

# Solicitar ao usuário as demais configurações
$PORT = Read-Host "Digite a porta do servidor (ex: 80)"
$TOKEN_DURATION = Read-Host "Digite a duração do token (ex: 30)"
$TOKEN_TIME_UNIT = Read-Host "Digite a unidade de tempo do token (ex: days)"
$NGROK_TOKEN = Read-Host "Digite o token do Ngrok"
$NGROK_DOMAIN = Read-Host "Digite o domínio do Ngrok"
$AUTHORIZED_USERS = Read-Host "Digite os IDs dos usuários autorizados separados por vírgula"
$BOT_TOKEN = Read-Host "Digite o token do bot do Telegram"

# Criar o arquivo .env
@"
# Configurações do Servidor
PORT=$PORT

# Configurações do Token JWT
TOKEN_DURATION=$TOKEN_DURATION
TOKEN_TIME_UNIT=$TOKEN_TIME_UNIT
SECRET_KEY=$SECRET_KEY
API_KEY=$API_KEY

# Configurações do Ngrok
NGROK_TOKEN=$NGROK_TOKEN
NGROK_DOMAIN=$NGROK_DOMAIN

# Configurações do Telegram Bot
AUTHORIZED_USERS=$AUTHORIZED_USERS
BOT_TOKEN=$BOT_TOKEN
"@ | Set-Content -Path ".env"

# Instalar dependências do bot
Write-Host "Instalando dependências do bot..."
python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao instalar as dependências."
    exit $LASTEXITCODE
}

# Iniciar a API e o bot
Write-Host "Iniciando a API e o bot..."
Start-Process powershell -ArgumentList "node api.js" -NoNewWindow
Start-Process powershell -ArgumentList "python bot.py" -NoNewWindow

Write-Host "Configuração concluída e programas iniciados."
