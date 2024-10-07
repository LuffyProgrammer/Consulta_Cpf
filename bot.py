import os
import re
import random
import string
import telepot
from telepot.loop import MessageLoop
from dotenv import load_dotenv, set_key
import requests

# Carregar variáveis de ambiente
load_dotenv()

# Carregar configurações do .env
BOT_TOKEN = os.getenv('BOT_TOKEN')
API_KEY = os.getenv('API_KEY')
AUTHORIZED_USERS = set(map(int, os.getenv('AUTHORIZED_USERS').split(',')))
TOKEN_URL = "http://localhost:80/gerar-token"
API_URL = os.getenv('NGROK_DOMAIN') + "/consultar-cpf"  # URL para consultar CPF

# Função para gerar uma nova chave de API
def generate_api_key(length=32):
    """Gera uma nova chave de API aleatória."""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

# Atualiza a chave da API no arquivo .env
def update_api_key():
    """Atualiza a chave da API no arquivo .env."""
    new_api_key = generate_api_key()
    set_key('.env', 'API_KEY', new_api_key)
    return new_api_key

# Atualiza o valor de uma variável no arquivo .env
def update_env_var(var_name, value):
    """Atualiza uma variável no arquivo .env."""
    set_key('.env', var_name, value)
    return value

# Função para tratar mensagens recebidas
def handle(msg):
    chat_id = msg['chat']['id']
    
    # Verifica se o usuário está autorizado
    if chat_id not in AUTHORIZED_USERS:
        bot.sendMessage(chat_id, '🚫 Você não está autorizado a usar este bot.')
        return
    
    command = msg['text']
    
    if command.startswith('/start'):
        bot.sendMessage(
            chat_id, 
            '*Olá! 👋*\n\n'
            'Use os seguintes comandos:\n\n'
            '/update_env <var> <valor> - Atualizar variáveis de ambiente 🛠️\n'
            '/create_user - Criar uma nova chave de API 🔑\n'
            '/get_token - Gerar um novo token JWT 🎟️', 
            parse_mode='Markdown'
        )
    elif command.startswith('/update_env'):
        parts = command.split(maxsplit=2)
        if len(parts) != 3:
            bot.sendMessage(chat_id, '⚠️ Uso: /update_env <var> <valor>', parse_mode='Markdown')
            return
        
        var_name, value = parts[1], parts[2]
        if not re.match(r'^[A-Z_]+$', var_name):
            bot.sendMessage(chat_id, '❌ O nome da variável deve estar em maiúsculas e usar _ apenas.', parse_mode='Markdown')
            return
        
        updated_value = update_env_var(var_name, value)
        bot.sendMessage(chat_id, f'✅ Variável `{var_name}` atualizada para `{updated_value}`', parse_mode='Markdown')
    elif command.startswith('/create_user'):
        new_api_key = update_api_key()
        bot.sendMessage(chat_id, f'🔑 Nova chave da API gerada: `{new_api_key}`', parse_mode='Markdown')
    elif command.startswith('/get_token'):
        try:
            response = requests.get(TOKEN_URL, headers={'x-api-key': API_KEY})
            response.raise_for_status()
            token_data = response.json()
            
            token = token_data.get('token', 'Token não encontrado')
            uid = token_data.get('uid', 'UID não encontrado')
            expires_in = token_data.get('expiresIn', 'Tempo de expiração não especificado')
            expiration_timestamp = token_data.get('expirationTimestamp', 'Timestamp de expiração não especificado')
            
            # Criar o comando curl
            curl_command = (
                f"```bash\n"
                f"curl --location 'https://{API_URL}' \\\n"
                f"--header 'Content-Type: application/json' \\\n"
                f"--header 'Authorization: Bearer {token}' \\\n"
                f"--data '{{\"cpf\":\"00000000272\"}}'\n"
                f"```"
            )
            
            message = (
                f'*🎟️ Token gerado:*\n`{token}`\n\n'
                f'*🆔 UID:* `{uid}`\n\n'
                f'*⏳ Tempo de expiração:* `{expires_in}`\n\n'
                f'*📅 Timestamp de expiração:* `{expiration_timestamp}`\n\n'
                f'*📋 Comando curl:* \n{curl_command}'
            )
            
            bot.sendMessage(chat_id, message, parse_mode='Markdown')
        except requests.RequestException as e:
            bot.sendMessage(chat_id, f'🚨 Erro ao obter o token: `{e}`', parse_mode='Markdown')
    else:
        bot.sendMessage(chat_id, '❓ Comando desconhecido. Use /start para ver os comandos disponíveis.', parse_mode='Markdown')

# Inicializa o bot
bot = telepot.Bot(BOT_TOKEN)
MessageLoop(bot, handle).run_as_thread()

print('Bot está rodando...')

# Mantém o bot ativo
import time
while True:
    time.sleep(10)
