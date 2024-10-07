# Documentação de Instalação e Uso da API

## Pré-requisitos

Certifique-se de que seu ambiente de desenvolvimento atenda aos seguintes requisitos:

- **Node.js**: Necessário para executar a API. Se não estiver instalado, o script de instalação cuidará disso automaticamente.
- **npm**: Instalado automaticamente junto com o Node.js.
- **PM2**: Gerenciador de processos para manter a API rodando em segundo plano.
- **Python**: Necessário para executar o bot do Telegram.

## Passo a Passo de Instalação

### 1. Obtenha o Código da API

Certifique-se de ter o código-fonte da API disponível no seu sistema.

### 2. Configurar o PowerShell para Permitir Scripts

Para permitir a execução de scripts PowerShell no Windows, siga estes passos:

1. **Abrir o PowerShell com Permissões de Administrador**:
   - Pressione `Win + X` e selecione **Windows PowerShell (Admin)** ou **Terminal Windows (Admin)**.
   - Alternativamente, você pode buscar por "PowerShell" no menu Iniciar, clicar com o botão direito do mouse e escolher **Executar como administrador**.

2. **Definir a Política de Execução**:
   Execute o seguinte comando para permitir a execução de scripts apenas para o processo atual:

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
   ```

   **Explicação dos Parâmetros**:
   - `-ExecutionPolicy RemoteSigned`: Permite a execução de scripts locais e scripts baixados da Internet que tenham uma assinatura digital válida.
   - `-Scope Process`: Aplica a configuração apenas ao processo atual do PowerShell.

3. **Confirmar a Alteração**:
   Se solicitado, digite `Y` e pressione `Enter` para confirmar.

### 3. Executar o Script de Configuração

Crie um arquivo PowerShell `setup.ps1` para configurar o ambiente e o arquivo `.env`. Use o código abaixo para gerar chaves secretas e configurar variáveis:

```powershell
# Gerar chaves secretas
function Generate-RandomString($length) {
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $result = ""
    for ($i = 0; $i -lt $length; $i++) {
        $result += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $result
}

if (-Not (Test-Path ".env")) {
    $apiKey = Generate-RandomString -length 32
    $secretKey = Generate-RandomString -length 32

    @"
# Configurações do Servidor
PORT=80

# Configurações do Token JWT
TOKEN_DURATION=30
TOKEN_TIME_UNIT=days
SECRET_KEY=$secretKey
API_KEY=$apiKey

# Configurações do Ngrok
NGROK_TOKEN=token do ngrok
NGROK_DOMAIN=dominio-freely.ngrok-free.app

# Configurações do Telegram Bot
AUTHORIZED_USERS=1102456807,1102456807
BOT_TOKEN=6540422218:AAHsy9xQHGhEODnBrsLQI_RV1Q0n5H0qjMY
"@ | Out-File -FilePath ".env"
    Write-Host ".env configurado com sucesso!"
} else {
    Write-Host ".env já existe. Configurações não alteradas."
}

# Executar scripts
Start-Process "cmd.exe" -ArgumentList "/c start cmd.exe /k 'npm install && pm2 start api.js --name sua_api && python bot.py'" -NoNewWindow
```

### 4. Executar o Script de Instalação

Execute o script `setup.ps1` para configurar o ambiente e iniciar a API e o bot:

```powershell
.\setup.ps1
```

### 5. Configuração do Arquivo `.env`

Após a execução do script `setup.ps1`, o arquivo `.env` será criado automaticamente. Certifique-se de revisar e ajustar os valores conforme suas necessidades:

```ini
# Configurações do Servidor
PORT=80

# Configurações do Token JWT
TOKEN_DURATION=30
TOKEN_TIME_UNIT=days
SECRET_KEY=SuaChaveSecreta
API_KEY=SuaChaveDaAPI

# Configurações do Ngrok
NGROK_TOKEN=dfv dfv dfg
NGROK_DOMAIN=freely.ngrok-free.app

# Configurações do Telegram Bot
AUTHORIZED_USERS=1102456807,1102456807
BOT_TOKEN=gdfgdfgdfghd
```

### 6. Iniciar a API e o Bot Manualmente

Se preferir iniciar manualmente, você pode usar os seguintes comandos:

- **Iniciar a API**:

  ```bash
  pm2 start api.js --name sua_api
  ```

- **Iniciar o Bot do Telegram**:

  ```bash
  python bot.py
  ```

### 7. Monitoramento e Logs

Utilize o PM2 para monitorar o status da API, verificar logs e reiniciar a aplicação.

- **Verificar o Status da API**:

  ```bash
  pm2 list
  ```

- **Verificar os Logs**:

  ```bash
  pm2 logs sua_api
  ```

- **Reiniciar a API**:

  ```bash
  pm2 restart sua_api
  ```

## Endpoints da API

### 1. Gerar Token de Autenticação

- **Método**: `GET`
- **Rota**: `/gerar-token`

**Exemplo de Requisição**:

```bash
curl -X GET \
  -H "x-api-key: SUA_CHAVE_DA_API" \
  http://localhost:3000/gerar-token
```

**Resposta Esperada**:

```json
{
  "token": "SEU_TOKEN_JWT"
}
```

### 2. Consulta por CPF

- **Método**: `POST`
- **Rota**: `/consultar-cpf`

**Exemplo de Requisição**:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"cpf": "NUMERO_DO_CPF"}' \
  http://localhost:3000/consultar-cpf
```

**Resposta Esperada**:

```json
{
  "cpf": "123.456.789-00",
  "nome": "João da Silva",
  "nascimento": "01/01/1980",
  "status": "Ativo",
  "dados_adicionais": { ... }
}
```

### 3. Rotas Protegidas

Todas as rotas que realizam consultas são protegidas por **Bearer Tokens**. Inclua o token JWT obtido na rota `/gerar-token` no cabeçalho de cada requisição subsequente.

## Considerações de Segurança

- **Chave Secreta**: Certifique-se de que a `SECRET_KEY` no arquivo `.env` seja segura e não seja compartilhada publicamente.
- **Autenticação**: Use sempre tokens JWT para acessar rotas protegidas.
- **API Key**: Mantenha a API Key configurada no `.env` confidencial e acessível apenas por sistemas autorizados.