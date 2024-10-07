const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const https = require('https');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

const SECRET_KEY = process.env.SECRET_KEY;
const API_KEY = process.env.API_KEY;
const TOKEN_DURATION = parseInt(process.env.TOKEN_DURATION, 10);
const TOKEN_TIME_UNIT = process.env.TOKEN_TIME_UNIT;
const NGROK_TOKEN = process.env.NGROK_TOKEN;
const NGROK_DOMAIN = process.env.NGROK_DOMAIN;

console.log('Chave secreta JWT:', SECRET_KEY);

app.use(bodyParser.json());

function getRandomBasicAuth(filePath) {
    try {
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        if (lines.length > 0) {
            const randomIndex = crypto.randomInt(0, lines.length);
            return lines[randomIndex].trim();
        } else {
            throw new Error('O arquivo está vazio.');
        }
    } catch (err) {
        throw new Error(`Erro ao ler o arquivo: ${err.message}`);
    }
}

function getAccessToken() {
    const url = 'https://servicos-cloud.saude.gov.br/pni-bff/v1/autenticacao/tokenAcesso';
    const authString = getRandomBasicAuth('basic_auth.txt');

    const headers = {
        'Connection': 'keep-alive',
        'Content-Length': '0',
        'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Microsoft Edge";v="128"',
        'accept': 'application/json',
        'X-Authorization': `Basic ${authString}`,
        'sec-ch-ua-mobile': '?0',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
        'sec-ch-ua-platform': '"Windows"',
        'Origin': 'https://si-pni.saude.gov.br',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://si-pni.saude.gov.br/',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'es,en-US;q=0.9,en;q=0.8,de;q=0.7,pt;q=0.6',
    };

    return new Promise((resolve, reject) => {
        https.request({ method: 'POST', headers, hostname: 'servicos-cloud.saude.gov.br', path: '/pni-bff/v1/autenticacao/tokenAcesso' }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(data);
                    resolve(jsonResponse.accessToken);
                } catch (e) {
                    reject({ error: 'Falha ao processar resposta JSON.', status_code: res.statusCode, response: data });
                }
            });
        }).on('error', e => reject({ error: e.message })).end();
    });
}

function getCpfData(accessToken, cpf) {
    const url = `https://servicos-cloud.saude.gov.br/pni-bff/v1/cidadao/cpf/${cpf}`;
    const headers = {
        'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
        'accept': 'application/json, text/plain, */*',
        'sec-ch-ua-mobile': '?0',
        'authorization': `Bearer ${accessToken}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'sec-ch-ua-platform': '"Windows"',
        'origin': 'https://si-pni.saude.gov.br',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://si-pni.saude.gov.br/',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'priority': 'u=1, i',
    };

    return new Promise((resolve, reject) => {
        https.request({ method: 'GET', headers, hostname: 'servicos-cloud.saude.gov.br', path: `/pni-bff/v1/cidadao/cpf/${cpf}` }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(data);
                    resolve(jsonResponse);
                } catch (e) {
                    reject({ error: 'Falha ao processar resposta JSON.', status_code: res.statusCode, response: data });
                }
            });
        }).on('error', e => reject({ error: e.message })).end();
    });
}

function getCnpjData(cnpj) {
    const url = `https://publica.cnpj.ws/cnpj/${cnpj}`;
    const headers = {
        'accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    };

    return new Promise((resolve, reject) => {
        https.request({ method: 'GET', headers, hostname: 'publica.cnpj.ws', path: `/cnpj/${cnpj}` }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(data);
                    resolve(jsonResponse);
                } catch (e) {
                    reject({ error: 'Falha ao processar resposta JSON.', status_code: res.statusCode, response: data });
                }
            });
        }).on('error', e => reject({ error: e.message })).end();
    });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

app.post('/consultar-cpf', authenticateToken, (req, res) => {
    const cpf = req.body.cpf;

    if (!cpf) {
        return res.status(400).json({ error: 'CPF é obrigatório' });
    }

    getAccessToken().then(accessToken => {
        return getCpfData(accessToken, cpf);
    }).then(result => {
        res.json(result);
    }).catch(error => {
        res.status(500).json(error);
    });
});

app.get('/consultar-cnpj', authenticateToken, (req, res) => {
    const cnpj = req.query.cnpj;

    if (!cnpj) {
        return res.status(400).json({ error: 'CNPJ é obrigatório' });
    }

    getCnpjData(cnpj)
        .then(result => {
            res.json(result);
        })
        .catch(error => {
            res.status(500).json(error);
        });
});

app.get('/gerar-token', (req, res) => {
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Chave de API inválida' });
    }

    const usuarioId = uuid.v4();
    const payload = { usuarioId };
    const options = { expiresIn: `${TOKEN_DURATION} ${TOKEN_TIME_UNIT}` };

    jwt.sign(payload, SECRET_KEY, options, (err, token) => {
        if (err) {
            console.error('Erro ao gerar token:', err);
            return res.status(500).json({ error: 'Erro ao gerar token' });
        }

        // Verificar e calcular o tempo de expiração
        const now = Math.floor(Date.now() / 1000);
        const expirationTime = now + TOKEN_DURATION * (TOKEN_TIME_UNIT === 'days' ? 86400 : 3600);
        
        res.json({
            token,
            uid: usuarioId,
            expiresIn: `${TOKEN_DURATION} ${TOKEN_TIME_UNIT}`,
            expirationTimestamp: expirationTime
        });
    });
});

// Nova rota para calcular o tempo restante até a expiração do token
app.get('/tempo-expiracao', authenticateToken, (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const expirationTime = req.user.exp; // O tempo de expiração do token está no payload do token
    const timeLeft = expirationTime - now;

    if (timeLeft > 0) {
        res.json({ timeLeft });
    } else {
        res.status(400).json({ error: 'O token já expirou.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
