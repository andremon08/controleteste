const URL_PLANILHA = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJq1BdeNlo6gvM1vBhtgD88MRevuRrODf2NmVESwH5CMQ6VBkuZMUaNEr8xCoHeJlmnlsJaDV_Cj9L/pub?gid=0&single=true&output=csv';

let dadosGlobais = [];

function iniciar() {
    if (URL_PLANILHA === 'COLE_AQUI_O_LINK_CSV_DA_SUA_PLANILHA') {
        alert("Atenção: Você precisa colocar o link da sua planilha no arquivo script.js!");
        return;
    }

    Papa.parse(URL_PLANILHA, {
        download: true,
        header: true,
        complete: function(resultados) {
            dadosGlobais = resultados.data;
            preencherFiltros();
        }
    });
}

function preencherFiltros() {
    const mesSelect = document.getElementById('mesSelect');
    const gabineteSelect = document.getElementById('gabineteSelect');

    const meses = new Set();
    const gabinetes = new Set();

    dadosGlobais.forEach(linha => {
        if (linha['Mês'] && linha['Gabinete']) {
            meses.add(linha['Mês']);
            gabinetes.add(linha['Gabinete']);
        }
    });

    mesSelect.innerHTML = '<option value="">Selecione...</option>';
    gabineteSelect.innerHTML = '<option value="">Selecione...</option>';

    meses.forEach(mes => {
        mesSelect.innerHTML += `<option value="${mes}">${mes}</option>`;
    });

    gabinetes.forEach(gab => {
        gabineteSelect.innerHTML += `<option value="${gab}">${gab}</option>`;
    });

    mesSelect.addEventListener('change', atualizarPainel);
    gabineteSelect.addEventListener('change', atualizarPainel);
}

function atualizarPainel() {
    const mesEscolhido = document.getElementById('mesSelect').value;
    const gabEscolhido = document.getElementById('gabineteSelect').value;
    const secaoResultados = document.getElementById('resultados');
    const estadoInicial = document.getElementById('estadoInicial');

    if (!mesEscolhido || !gabEscolhido) {
        secaoResultados.classList.add('escondido');
        estadoInicial.style.display = 'flex';
        return;
    }

    secaoResultados.classList.remove('escondido');
    estadoInicial.style.display = 'none';

    // Atualiza o breadcrumb
    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) {
        breadcrumb.textContent = `${mesEscolhido} · ${gabEscolhido}`;
    }

    const dadosFiltrados = dadosGlobais.filter(linha =>
        linha['Mês'] === mesEscolhido &&
        linha['Gabinete'] === gabEscolhido
    );

    preencherOrcamento(dadosFiltrados);
    preencherEquipe(dadosFiltrados);
}

function preencherOrcamento(dados) {
    if (dados.length > 0) {
        const verbaTotal = parseFloat(dados[0]['Verba Total']) || 0;
        const verbaUtilizada = parseFloat(dados[0]['Verba Utilizada']) || 0;
        const saldo = verbaTotal - verbaUtilizada;

        const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        document.getElementById('verbaTotal').innerText = formatarMoeda(verbaTotal);
        document.getElementById('verbaUtilizada').innerText = formatarMoeda(verbaUtilizada);
        document.getElementById('verbaSaldo').innerText = formatarMoeda(saldo);

        // Atualiza barra de progresso
        const pct = verbaTotal > 0 ? Math.min((verbaUtilizada / verbaTotal) * 100, 100) : 0;
        const fill = document.getElementById('progressoFill');
        const pctLabel = document.getElementById('progressoPct');
        if (fill) fill.style.width = pct.toFixed(1) + '%';
        if (pctLabel) pctLabel.textContent = pct.toFixed(1) + '%';
    }
}

function preencherEquipe(dados) {
    const corpoTabela = document.getElementById('corpoTabela');
    corpoTabela.innerHTML = '';

    dados.forEach(linha => {
        if (linha['Nome do Servidor']) {
            corpoTabela.innerHTML += `
                <tr>
                    <td>${linha['Nome do Servidor']}</td>
                    <td>${linha['Cargo'] || 'Não especificado'}</td>
                </tr>
            `;
        }
    });
}

iniciar();
