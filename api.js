// Importação de dependências
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const https = require('https');
require('dotenv').config();

// Inicialização da aplicação Express
const app = express();
const port = process.env.PORT || 8080;

// Carregamento de variáveis de ambiente
const { SECRET_KEY, API_KEY, TOKEN_DURATION, TOKEN_TIME_UNIT, NGROK_TOKEN, NGROK_DOMAIN } = process.env;

// Middleware para processamento de JSON
app.use(bodyParser.json());

// Função para ler uma linha aleatória de um arquivo
const getRandomBasicAuth = (filePath) => {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    if (lines.length === 0) throw new Error('Arquivo vazio.');
    const randomIndex = crypto.randomInt(0, lines.length);
    return lines[randomIndex].trim();
};

// Função para obter o token de acesso
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
        https.request({ method: 'POST', headers, hostname: 'servicos-cloud.saude.gov.br', path: '/pni-bff/v1/autenticacao/tokenAcesso' }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(data);
                    resolve(jsonResponse.accessToken);
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
                        return reject({ error: 'CPF não encontrado.', status: res.statusCode });
                    }
                    resolve(jsonResponse);
                } catch (e) {
                    reject({ error: 'Erro ao processar resposta.', status_code: res.statusCode, response: data });
                }
            });
        }).on('error', e => reject({ error: e.message })).end();
    });
};

// Função para obter dados de CNPJ
const getCnpjData = (cnpj) => {
    const url = `https://publica.cnpj.ws/cnpj/${cnpj}`;
    const headers = {
        'accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
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
                    reject({ error: 'Erro ao processar resposta.', status_code: res.statusCode, response: data });
                }
            });
        }).on('error', e => reject({ error: e.message })).end();
    });
};

// Função para obter informações de endereço pelo CEP
const getAddressByCep = (cep) => {
    return new Promise((resolve, reject) => {
        https.get(`https://viacep.com.br/ws/${cep}/json/`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const addressResponse = JSON.parse(data);
                    if (addressResponse.erro) {
                        return reject({ error: 'CEP não encontrado.' });
                    }
                    resolve(addressResponse);
                } catch (e) {
                    reject({ error: 'Erro ao processar resposta do CEP.', response: data });
                }
            });
        }).on('error', e => reject({ error: e.message })).end();
    });
};

// Middleware para autenticar token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token não fornecido' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

// Função para formatar a data de expiração
const formatExpirationDate = (timestamp) => {
    const expirationDate = new Date(timestamp * 1000);
    return expirationDate.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

// Rota para consultar CPF
app.post('/consultar-cpf', authenticateToken, (req, res) => {
    const cpf = req.body.cpf;

    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });

    getAccessToken()
        .then(accessToken => getCpfData(accessToken, cpf))
        .then(async (result) => {
            if (result.records.length > 0) {
                const { endereco } = result.records[0];
                if (endereco && endereco.cep) {
                    // Consulta o endereço via API ViaCEP
                    const addressData = await getAddressByCep(endereco.cep);
                    
                    // Monta a resposta unificada com os dados do CPF e do endereço
                    return res.json({
                        records: result.records,
                        endereco: {
                            logradouro: addressData.logradouro,
                            numero: endereco.numero,
                            complemento: endereco.complemento,
                            bairro: addressData.bairro,
                            municipio: addressData.localidade,
                            siglaUf: addressData.uf,
                            cep: addressData.cep,
                        }
                    });
                }
            }
            return res.json(result);
        })
        .catch(error => res.status(error.status || 500).json(error));
});


// Rota para consultar CNPJ
app.get('/consultar-cnpj', authenticateToken, (req, res) => {
    const cnpj = req.query.cnpj;

    if (!cnpj) return res.status(400).json({ error: 'CNPJ é obrigatório' });

    getCnpjData(cnpj)
        .then(result => res.json(result))
        .catch(error => res.status(500).json(error));
});

// Rota para gerar token
app.get('/gerar-token', (req, res) => {
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Chave de API inválida' });

    const usuarioId = uuid.v4();
    const payload = { usuarioId };
    const options = { expiresIn: `${TOKEN_DURATION} ${TOKEN_TIME_UNIT}` };

    jwt.sign(payload, SECRET_KEY, options, (err, token) => {
        if (err) {
            console.error('Erro ao gerar token:', err);
            return res.status(500).json({ error: 'Erro ao gerar token' });
        }

        const now = Math.floor(Date.now() / 1000);
        const expirationTime = now + (TOKEN_DURATION * (TOKEN_TIME_UNIT === 'days' ? 86400 : 3600));
        const formattedExpirationDate = formatExpirationDate(expirationTime);
        
        res.json({
            token,
            uid: usuarioId,
            expiresIn: `${TOKEN_DURATION} ${TOKEN_TIME_UNIT}`,
            expirationTimestamp: expirationTime,
            formattedExpirationDate // Data de expiração legível
        });
    });
});

// Rota para calcular o tempo restante até a expiração do token
app.get('/tempo-expiracao', authenticateToken, (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const expirationTime = req.user.exp;
    const timeLeft = expirationTime - now;

    if (timeLeft > 0) {
        return res.json({
            success: true,
            message: 'O token é válido.',
            data: {
                timeLeft,
                expirationTimestamp: expirationTime,
                userData: req.user  // Usando os dados do usuário do token gerado
            }
        });
    } else {
        return res.status(400).json({
            success: false,
            error: 'O token já expirou.',
            message: 'Por favor, faça login novamente para obter um novo token.',
            userData: req.user  // Usando os dados do usuário do token gerado
        });
    }
});

app.get('/', (req, res) => {
    res.redirect('/consultar');
});

app.get('/consultar', (req, res) => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consulta de Dados</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Roboto', sans-serif;
            background-color: #e9ecef;
            padding: 20px;
            margin: 0;
            color: #343a40;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            text-align: center;
            color: #007bff;
            margin-bottom: 20px;
        }
        label {
            margin-top: 10px;
            font-weight: bold;
        }
        input[type="file"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            margin-bottom: 10px;
            font-size: 16px;
        }
        select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 20px;
            margin-bottom: 10px;
            font-size: 16px;
            background-color: #ffffff;
        }
        input[type="text"] {
            width: calc(100% - 80px);
            padding: 12px;
            border: 1px solid #ced4da;
            border-radius: 20px;
            font-size: 16px;
            margin-bottom: 10px;
        }
        .consulta-container {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        button {
            width: 60px;
            height: 60px;
            border: none;
            border-radius: 50%;
            background-color: transparent;
            color: #007bff;
            cursor: pointer;
            margin-left: 10px;
            transition: background-color 0.3s;
            position: relative;
            outline: none;
        }
        button:hover {
            background-color: rgba(0, 123, 255, 0.1);
        }
        .loading {
            display: none;
            margin-top: 10px;
            text-align: center;
        }
        .resultado {
            margin-top: 20px;
            background-color: #f8f9fa;
            border: 1px solid #ced4da;
            border-radius: 4px;
            padding: 10px;
            max-height: 200px;
            overflow-y: auto;
            font-family: monospace;
            white-space: pre-wrap;
            display: none; /* Inicialmente escondido */
        }
        .welcome-message {
            font-size: 18px;
            font-weight: bold;
            margin-top: 10px;
            color: #007bff;
        }
        .lupa-icon {
            width: 30px;
            height: 30px;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Consulta de Dados</h1>

        <input type="file" id="jsonFile" accept=".json">

        <div id="welcomeMessage" class="welcome-message" style="display:none;"></div>

        <label for="tipoConsulta">Tipo de Consulta:</label>
        <select id="tipoConsulta">
            <option value="none">Selecione a consulta.</option>
            <option value="cpf">Consulta CPF</option>
            <option value="cnpj">Consulta CNPJ</option>
        </select>

        <label for="documento">Documento:</label>
        <div class="consulta-container">
            <input type="text" id="documento" placeholder="Digite o CPF ou CNPJ sem traços e pontu" required>
            <button onclick="consultar()">
                <img src="https://files.catbox.moe/fh5q0r.png" alt="Lupa" class="lupa-icon">
            </button>
        </div>

        <div class="loading" id="loading">
            <img src="https://files.catbox.moe/4i9oci.gif" alt="Loading" style="width: 80px;">
        </div>

        <div id="resultado" class="resultado"></div>

        <div style="margin-top: 10px; text-align: center;">
            <p>Isso deu trabalho, ajude o projeto a ficar ativo!</p>
        </div>
        <div style="margin-top: 10px; text-align: center;">
            <p>As vezes a consulta não funciona, irei corrigir na próxima versão.!</p>
        </div>
        <div style="margin-top: 10px; text-align: center;">
            <p>Telegram:@Luiz_Eduardo Marido de Nicolle.!</p>
        </div>
    </div>

    <script>
        let jwtToken = '';

        document.getElementById('jsonFile').addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const jsonData = JSON.parse(e.target.result);
                        document.getElementById('welcomeMessage').style.display = 'block';
                        document.getElementById('welcomeMessage').innerHTML = \`Olá, \${jsonData.nome}.                                                    Data: \${new Date().toLocaleDateString('pt-BR')}\`;
                        jwtToken = jsonData.token;
                        document.getElementById('jsonFile').style.display = 'none';
                    } catch (error) {
                        alert('Erro ao ler o arquivo JSON: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        });

        async function consultar() {
            const tipoConsulta = document.getElementById('tipoConsulta').value;
            let documento = document.getElementById('documento').value;

            documento = documento.replace(/\D/g, '');

            const loadingDiv = document.getElementById('loading');
            loadingDiv.style.display = 'block';

            let response;
            try {
                if (tipoConsulta === 'cpf') {
                    response = await fetch(\`/formatar-cpf?cpf=\${documento}\`, {
                        method: 'GET',
                        headers: {
                            'Authorization': \`Bearer \${jwtToken}\`
                        }
                    });
                } else {
                    response = await fetch(\`/formatar-cnpj?cnpj=\${documento}\`, {
                        method: 'GET',
                        headers: {
                            'Authorization': \`Bearer \${jwtToken}\`
                        }
                    });
                }

                if (!response.ok) {
                    const errorResponse = await response.text();
                    throw new Error(errorResponse || 'Erro na consulta');
                }

                const resultHtml = await response.text();
                const resultadoDiv = document.getElementById('resultado');
                resultadoDiv.innerHTML = resultHtml;
                resultadoDiv.style.display = 'block'; // Exibe o campo de resultado
            } catch (error) {
                document.getElementById('resultado').innerText = 'Erro: ' + error.message;
                document.getElementById('resultado').style.display = 'block'; // Exibe o campo de resultado em caso de erro
            } finally {
                loadingDiv.style.display = 'none';
            }
        }
    </script>
</body>
</html>
    `;
    res.send(htmlContent);
});

// Nova rota para formatar e retornar informações do CPF em HTML
app.get('/formatar-cpf', authenticateToken, (req, res) => {
    const cpf = req.query.cpf; // Obtendo o CPF a partir dos parâmetros da consulta

    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });

    getAccessToken()
        .then(accessToken => getCpfData(accessToken, cpf))
        .then(async (result) => {
            if (result.records.length > 0) {
                const record = result.records[0];

                const response = "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Informações do CPF</title></head><body>" +
                    `<p><strong>Nome:</strong> ${record.nome}</p>` +
                    `<p><strong>CPF:</strong> ${record.cpf}</p>` +
                    `<p><strong>Data de Nascimento:</strong> ${record.dataNascimento}</p>` +
                    `<p><strong>Sexo:</strong> ${record.sexo}</p>` +
                    `<p><strong>Identidade de Gênero:</strong> ${record.identidadeGenero}</p>` +
                    `<p><strong>Nome da Mãe:</strong> ${record.nomeMae}</p>` +
                    `<p><strong>Nome do Pai:</strong> ${record.nomePai}</p>` +
                    `<p><strong>Tipo Sanguíneo:</strong> ${record.tipoSanguineo}</p>` +
                    `<p><strong>Ativo:</strong> ${record.ativo}</p>` +
                    `<p><strong>Óbito:</strong> ${record.obito}</p>` +
                    `<p><strong>Parto Gemelar:</strong> ${record.partoGemelar}</p>` +
                    `<p><strong>VIP:</strong> ${record.vip}</p>` +
                    `<p><strong>Raça/COR:</strong> ${record.racaCor}</p>` +
                    `<p><strong>Estado Civil:</strong> ${record.estadoCivil}</p>` +
                    `<p><strong>Escolaridade:</strong> ${record.escolaridade}</p>` +
                    `<h2>Telefones</h2>` +
                    `${record.telefone.map(t => `<p>${t.ddi} (${t.ddd}) ${t.numero} - Tipo: ${t.tipo}</p>`).join('')}` +
                    `<h2>E-mails</h2>` +
                    `${record.email.map(e => `<p>${e.email} - Tipo: ${e.tipo}</p>`).join('')}` +
                    `<h2>Nacionalidade</h2>` +
                    `<p><strong>Código Nacionalidade:</strong> ${record.nacionalidade.nacionalidade}</p>` +
                    `<p><strong>Município Nascimento:</strong> ${record.nacionalidade.municipioNascimento}</p>` +
                    `<p><strong>País Nascimento:</strong> ${record.nacionalidade.paisNascimento}</p>` +
                    `<h2>Endereço</h2>` +
                    `<p><strong>Logradouro:</strong> ${record.endereco.logradouro}, ${record.endereco.numero}</p>` +
                    `<p><strong>Bairro:</strong> ${record.endereco.bairro}</p>` +
                    `<p><strong>Município:</strong> ${record.endereco.municipio}</p>` +
                    `<p><strong>Estado:</strong> ${record.endereco.siglaUf}</p>` +
                    `<p><strong>CEP:</strong> ${record.endereco.cep}</p>` +
                    `<p><strong>Fora de Área:</strong> ${record.foraDeArea}</p>` +
                    `</body></html>`;
                res.send(response);
            } else {
                return res.status(404).json({ error: 'Nenhum registro encontrado.' });
            }
        })
        .catch(error => res.status(error.status || 500).json({ error: error.message }));
});

app.get('/formatar-cnpj', (req, res) => {
    const cnpj = req.query.cnpj;

    if (!cnpj) return res.status(400).json({ error: 'CNPJ é obrigatório' });

    getCnpjData(cnpj)
        .then(result => {
            const response = "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Informações do CNPJ</title></head><body>" +
                `<p><strong>CNPJ:</strong> ${result.estabelecimento.cnpj} - ${result.cnpj_raiz}</p>` +
                `<p><strong>Razão Social:</strong> ${result.razao_social}</p>` +
                `<p><strong>Data da Abertura:</strong> ${result.simples.data_opcao_mei} (${calculateAge(result.simples.data_opcao_mei)})</p>` +
                `<p><strong>Porte:</strong> ${result.porte.descricao}</p>` +
                `<p><strong>Natureza Jurídica:</strong> ${result.natureza_juridica.descricao}</p>` +
                `<p><strong>Opção pelo MEI:</strong> ${result.simples.mei}</p>` +
                `<p><strong>Opção pelo Simples:</strong> ${result.simples.simples}</p>` +
                `<p><strong>Data opção Simples:</strong> ${result.simples.data_opcao_simples}</p>` +
                `<p><strong>Capital Social:</strong> R$ ${result.capital_social}</p>` +
                `<p><strong>Tipo:</strong> ${result.estabelecimento.tipo}</p>` +
                `<p><strong>Situação:</strong> ${result.estabelecimento.situacao_cadastral}</p>` +
                `<p><strong>Data Situação Cadastral:</strong> ${result.estabelecimento.data_situacao_cadastral}</p>` +
                `<h2>Contatos</h2>` +
                `<p><strong>E-mail:</strong> <a href="mailto:${result.estabelecimento.email}">${result.estabelecimento.email}</a></p>` +
                `<p><strong>Telefone(s):</strong> <a href="tel:${result.estabelecimento.telefone1}">(${result.estabelecimento.telefone1})</a></p>` +
                `<h2>Localização</h2>` +
                `<p><strong>Logradouro:</strong> ${result.estabelecimento.logradouro}, ${result.estabelecimento.numero}</p>` +
                `<p><strong>Bairro:</strong> ${result.estabelecimento.bairro}</p>` +
                `<p><strong>CEP:</strong> ${result.estabelecimento.cep}</p>` +
                `<p><strong>Município:</strong> ${result.estabelecimento.cidade.nome}</p>` +
                `<p><strong>Estado:</strong> ${result.estabelecimento.estado.sigla}</p>` +
                `</body></html>`;
            res.send(response);
        })
        .catch(error => res.status(500).json({ error: error.message }));
});

// Função para calcular a idade
function calculateAge(dateString) {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return `${age} anos`;
}

// Inicialização do servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    
    // Execução do ngrok
    const ngrokCommand = `ngrok http --domain=${NGROK_DOMAIN} ${port}`;
    exec(ngrokCommand, (err, stdout, stderr) => {
        if (err) {
            console.error(`Erro ao executar o ngrok: ${err.message}`);
            return;
        }
        console.log(`ngrok iniciado: ${stdout}`);
    });
});
