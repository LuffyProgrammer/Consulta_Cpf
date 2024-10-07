

# Documentação de Instalação e Uso da API

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Passo a Passo de Instalação](#passo-a-passo-de-instalação)
   - [Obtenha o Código da API](#1-obtenha-o-código-da-api)
   - [Configurar o PowerShell para Permitir Scripts](#2-configurar-o-powershell-para-permitir-scripts)
   - [Executar o Script de Configuração](#3-executar-o-script-de-configuração)
   - [Executar o Script de Instalação](#4-executar-o-script-de-instalação)
   - [Configuração do Arquivo `.env`](#5-configuração-do-arquivo-env)
   - [Iniciar a API Manualmente](#6-iniciar-a-api-manualmente)
   - [Monitoramento e Logs](#7-monitoramento-e-logs)
3. [Endpoints da API](#endpoints-da-api)
   - [1. Gerar Token de Autenticação](#1-gerar-token-de-autenticação)
   - [2. Consulta por CPF](#2-consulta-por-cpf)
   - [3. Consulta por CNPJ](#3-consulta-por-cnpj)
   - [4. Calcular Tempo Restante até Expiração do Token](#4-calcular-tempo-restante-até-expiração-do-token)
4. [Estrutura de Respostas e Códigos de Erro](#estrutura-de-respostas-e-códigos-de-erro)
5. [Considerações de Segurança](#considerações-de-segurança)

## Pré-requisitos

Certifique-se de que seu ambiente de desenvolvimento atenda aos seguintes requisitos:

- **Node.js**: Necessário para executar a API. Se não estiver instalado, o script de instalação cuidará disso automaticamente.
- **npm**: Instalado automaticamente junto com o Node.js.
- **PM2**: Gerenciador de processos para manter a API rodando em segundo plano.

## Passo a Passo de Instalação

### 1. Obtenha o Código da API

Certifique-se de ter o código-fonte da API disponível no seu sistema. Você pode clonar o repositório do GitHub ou transferir os arquivos diretamente para o seu ambiente de desenvolvimento.

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
PORT=8080

# Configurações do Token JWT
TOKEN_DURATION=30
TOKEN_TIME_UNIT=days
SECRET_KEY=$secretKey
API_KEY=$apiKey

# Configurações do Ngrok
NGROK_TOKEN=token do ngrok
NGROK_DOMAIN=dominio-freely.ngrok-free.app
"@ | Out-File -FilePath ".env"
    Write-Host ".env configurado com sucesso!"
} else {
    Write-Host ".env já existe. Configurações não alteradas."
}

# Executar scripts
Start-Process "cmd.exe" -ArgumentList "/c start cmd.exe /k 'npm install && pm2 start api.js --name sua_api'" -NoNewWindow
```

### 4. Executar o Script de Instalação

Execute o script `setup.ps1` para configurar o ambiente e iniciar a API:

```powershell
.\setup.ps1
```

### 5. Configuração do Arquivo `.env`

Após a execução do script `setup.ps1`, o arquivo `.env` será criado automaticamente. Certifique-se de revisar e ajustar os valores conforme suas necessidades:

```ini
# Configurações do Servidor
PORT=8080

# Configurações do Token JWT
TOKEN_DURATION=30
TOKEN_TIME_UNIT=days
SECRET_KEY=SuaChaveSecreta
API_KEY=SuaChaveDaAPI

# Configurações do Ngrok
NGROK_TOKEN=dfv dfv dfg
NGROK_DOMAIN=freely.ngrok-free.app
```

### 6. Iniciar a API Manualmente

Se preferir iniciar manualmente, você pode usar os seguintes comandos:

- **Iniciar a API**:

  ```bash
  pm2 start api.js --name sua_api
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

**Descrição**: Gera um novo token JWT para autenticação.

**Parâmetros de Cabeçalho**:
- `x-api-key`: Chave da API (string) - **obrigatório**.

**Exemplo de Requisição**:

```bash
curl -X GET \
  -H "x-api-key: SUA_CHAVE_DA_API" \
  http://localhost:8080/gerar-token
```

**Resposta Esperada**:

```json
{
  "token": "SEU_TOKEN_JWT",
  "uid": "ID_UNICO_DO_USUARIO",
  "expiresIn": "30 days",
  "expirationTimestamp": 1681234567,
  "formattedExpirationDate": "01/01/2024 12:00:00"
}
```

### 2. Consulta por CPF

- **Método**: `POST`
- **Rota**: `/consultar-cpf`

**Descrição**: Consulta informações detalhadas sobre um CPF.

**Corpo da Requisição**:

```json
{
  "cpf": "NUMERO_DO_CPF"
}
```

**Exemplo de Requisição**:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"cpf": "12345678909"}' \
  http://localhost:8080/consultar-cpf
```

**Resposta Esperada**:

```json
{
  "records": [
    {
      "nome": "João da Silva",
      "cpf": "123.456.789-00",
      "dataNascimento": "01/01/1980",
      "sexo": "Masculino",
      "endereco": {
        "logradouro": "Rua das Flores",
        "numero": "123",
        "bairro": "Centro",
        "municipio": "São Paulo",
        "siglaUf": "SP",
        "cep": "01234-567"
      }
    }
  ],
  "endereco": {
    "logradouro": "Rua das Flores",
    "numero": "123",
    "complemento": "Apto 101",
    "bairro": "Centro",
    "municipio": "São Paulo",
    "siglaUf": "SP",
    "cep": "01234-567"
  }
}
```

### 3. Consulta por CNPJ

- **Método**: `GET`
- **Rota**: `/consultar-cnpj`

**Descrição**: Consulta informações detalhadas sobre um CNPJ.

**Parâmetros da Consulta**:
- `cnpj`: CNPJ a ser consultado (string) - **obrigatório**.

**Exemplo de Re

quisição**:

```bash
curl -X GET \
  -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:8080/consultar-cnpj?cnpj=12345678000195
```

**Resposta Esperada**:

```json
{
  "estabelecimento": {
    "cnpj": "12.345.678/0001-95",
    "razao_social": "Empresa Exemplo Ltda",
    "situacao_cadastral": "Ativa",
    "data_situacao_cadastral": "01/01/2020",
    "email": "contato@empresa.com",
    "telefone1": "(11) 1234-5678",
    "logradouro": "Avenida das Empresas",
    "numero": "1000",
    "bairro": "Industrial",
    "cep": "12345-678",
    "cidade": {
      "nome": "São Paulo"
    },
    "estado": {
      "sigla": "SP"
    }
  }
}
```

### 4. Calcular Tempo Restante até Expiração do Token

- **Método**: `GET`
- **Rota**: `/tempo-expiracao`

**Descrição**: Calcula o tempo restante até a expiração do token JWT.

**Exemplo de Requisição**:

```bash
curl -X GET \
  -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:8080/tempo-expiracao
```

**Resposta Esperada**:

```json
{
  "success": true,
  "message": "O token é válido.",
  "data": {
    "timeLeft": 1200,
    "expirationTimestamp": 1681234567,
    "userData": {
      "usuarioId": "ID_UNICO_DO_USUARIO",
      "exp": 1681234567
    }
  }
}
```

## Estrutura de Respostas e Códigos de Erro

### Códigos de Resposta Comuns

- **200 OK**: A solicitação foi bem-sucedida e a resposta contém os dados solicitados.
- **400 Bad Request**: A solicitação é inválida ou faltando parâmetros obrigatórios.
- **401 Unauthorized**: O token de autenticação não foi fornecido ou é inválido.
- **403 Forbidden**: O token de autenticação é válido, mas o usuário não tem permissão para acessar o recurso.
- **404 Not Found**: O recurso solicitado não foi encontrado.
- **500 Internal Server Error**: Ocorreu um erro no servidor ao processar a solicitação.

### Exemplo de Mensagem de Erro

```json
{
  "error": "CPF é obrigatório"
}
```

## Considerações de Segurança

- **Chave Secreta**: Certifique-se de que a `SECRET_KEY` no arquivo `.env` seja segura e não seja compartilhada publicamente.
- **Autenticação**: Use sempre tokens JWT para acessar rotas protegidas.
- **API Key**: Mantenha a API Key configurada no `.env` confidencial e acessível apenas por sistemas autorizados.

## Monitoramento e Manutenção

- **Monitoramento**: Utilize ferramentas como PM2 para monitorar a saúde da aplicação e coletar logs.
- **Atualizações**: Mantenha suas dependências atualizadas e revise o código para garantir que ele atenda aos padrões de segurança mais recentes.
- **Backups**: Realize backups regulares da base de dados e da configuração do servidor.
