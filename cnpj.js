const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const { exec } = require('child_process');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

const NGROK_DOMAIN = process.env.NGROK_DOMAIN;

app.use(bodyParser.json());

function getCnpjData(cnpj) {
    const url = `https://publica.cnpj.ws/cnpj/${cnpj}`;
    const headers = {
        'accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'
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

// Rota para consultar CNPJ sem autenticação
app.post('/consultar-cnpj', (req, res) => {
    const cnpj = req.body.cnpj;

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

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    const ngrokCommand = `ngrok http --domain=${NGROK_DOMAIN} ${port}`;
    exec(ngrokCommand, (err, stdout, stderr) => {
        if (err) {
            console.error('Erro ao iniciar o ngrok:', stderr);
            return;
        }
        console.log('Ngrok iniciado com sucesso:', stdout);
    });
});
