const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const getRandomBasicAuth = (filePath) => {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    if (lines.length === 0) throw new Error('Arquivo vazio.');
    const randomIndex = crypto.randomInt(0, lines.length);
    return lines[randomIndex].trim();
};

const getAccessToken = () => {
    const authString = getRandomBasicAuth('basic_auth.txt');
    const headers = {
        'Connection': 'keep-alive',
        'Content-Length': '0',
        'accept': 'application/json',
        'X-Authorization': `Basic ${authString}`,
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://si-pni.saude.gov.br',
    };

    return new Promise((resolve, reject) => {
        https.request({ 
            method: 'POST', 
            headers, 
            hostname: 'servicos-cloud.saude.gov.br', 
            path: '/pni-bff/v1/autenticacao/tokenAcesso' 
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Resposta da API (Token Acesso):', data); // Adicionado para verificar a resposta
                try {
                    const jsonResponse = JSON.parse(data);
                    if (jsonResponse.accessToken) {
                        resolve(jsonResponse.accessToken);
                    } else {
                        reject({ error: 'Token de acesso não encontrado.', status_code: res.statusCode, response: data });
                    }
                } catch (e) {
                    reject({ error: 'Erro ao processar resposta.', status_code: res.statusCode, response: data });
                }
            });
        }).on('error', e => reject({ error: e.message })).end();
    });
};

// Função para obter dados de CPF
const getCpfData = (accessToken, cpf) => {
    const url = `https://servicos-cloud.saude.gov.br/pni-bff/v1/cidadao/cpf/${cpf}`;
    const headers = {
        'accept': 'application/json',
        'authorization': `Bearer ${accessToken}`,
        'user-agent': 'Mozilla/5.0',
        'origin': 'https://si-pni.saude.gov.br',
    };

    return new Promise((resolve, reject) => {
        https.request({ method: 'GET', headers, hostname: 'servicos-cloud.saude.gov.br', path: `/pni-bff/v1/cidadao/cpf/${cpf}` }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(data);
                    if (res.statusCode !== 200) {
                        // Se o CPF não for encontrado ou ocorrer um erro
                        if (res.statusCode === 401) {
                            return reject({
                                error: 'CPF não encontrado.',
                                status: res.statusCode,
                                authHeader: `Bearer ${accessToken}`  // Retorna o header de autenticação
                            });
                        }
                        return reject({ error: 'Erro desconhecido.', status: res.statusCode });
                    }
                    resolve(jsonResponse);
                } catch (e) {
                    reject({ error: 'Erro ao processar resposta.', status_code: res.statusCode, response: data });
                }
            });
        }).on('error', e => reject({ error: e.message })).end();
    });
};

// Exemplo de uso
getAccessToken()
    .then(accessToken => {
        console.log('Access Token recebido:', accessToken); // Exibe o token recebido
        return getCpfData(accessToken, '12345678900');
    })
    .then(data => {
        console.log('Dados do CPF:', data);
    })
    .catch(err => {
        console.log('Erro:', err);
    });
