// ─── CONFIGURAÇÃO ───────────────────────────────────────────────────────────
// Substitua os GIDs pelos IDs corretos de cada aba da sua planilha.
// Para encontrar o GID: abra a aba no Sheets e veja o número após "gid=" na URL.
const BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJq1BdeNlo6gvM1vBhtgD88MRevuRrODf2NmVESwH5CMQ6VBkuZMUaNEr8xCoHeJlmnlsJaDV_Cj9L/pub';

const URL_VERBAS     = BASE_URL + '?gid=0&single=true&output=csv';       // aba "verbas"
const URL_SERVIDORES = BASE_URL + '?gid=SUBSTITUA_GID_SERVIDORES&single=true&output=csv'; // aba "servidores"
const URL_CARGOS     = BASE_URL + '?gid=SUBSTITUA_GID_CARGOS&single=true&output=csv';    // aba "cargos"

// ─── REGRAS DE NEGÓCIO ──────────────────────────────────────────────────────
const TETO_VEREADOR   = 92998.45;
const TOLERANCIA      = 0.13;
const MAX_SERVIDORES  = 9;

// Estrutura fixa de cargos por lotação especial
const ESTRUTURA_ESPECIAL = {
    'Presidência':          ['CC-1', 'CC-5', 'CC-6', 'CC-7'],
    '1ª Vice-Presidência':  ['CC-4', 'CC-6'],
    '2ª Vice-Presidência':  ['CC-4', 'CC-7'],
    '1ª Secretaria':        ['CC-3', 'CC-6', 'CC-7'],
    '2ª Secretaria':        ['CC-4', 'CC-6', 'CC-7'],
    '3ª Secretaria':        ['CC-5', 'CC-7'],
    '4ª Secretaria':        ['CC-5', 'CC-7'],
};
// Blocos e lideranças: qualquer gabinete não listado acima e não "Gabinete XX"
// é tratado como bloco/liderança com 1 vaga de CC-8.

// ─── ESTADO GLOBAL ──────────────────────────────────────────────────────────
let dadosVerbas     = [];
let dadosServidores = [];
let tabelaCargos    = {}; // { 'CC-1': 12000.00, ... }

// ─── INICIALIZAÇÃO ──────────────────────────────────────────────────────────
function iniciar() {
    const promessas = [
        carregarCSV(URL_VERBAS),
        carregarCSV(URL_SERVIDORES),
        carregarCSV(URL_CARGOS),
    ];

    Promise.all(promessas)
        .then(([verbas, servidores, cargos]) => {
            dadosVerbas     = verbas;
            dadosServidores = servidores;
            tabelaCargos    = construirTabelaCargos(cargos);
            preencherFiltros();
            setStatus('ok', 'Dados carregados');
        })
        .catch(err => {
            console.error(err);
            setStatus('erro', 'Erro ao carregar dados');
        });
}

function carregarCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: r => resolve(r.data),
            error: e => reject(e),
        });
    });
}

function construirTabelaCargos(linhas) {
    const tabela = {};
    linhas.forEach(l => {
        const cargo   = (l['Cargo'] || '').trim();
        const salario = parseFloat((l['Salário'] || l['Salario'] || '0').toString().replace(',', '.')) || 0;
        if (cargo) tabela[cargo] = salario;
    });
    return tabela;
}

// ─── FILTROS ────────────────────────────────────────────────────────────────
function preencherFiltros() {
    const mesSelect = document.getElementById('mesSelect');
    const gabSelect = document.getElementById('gabineteSelect');

    const meses     = new Set();
    const gabinetes = new Set();

    dadosVerbas.forEach(l => {
        if (l['Mês'] && l['Gabinete']) {
            meses.add(l['Mês'].trim());
            gabinetes.add(l['Gabinete'].trim());
        }
    });

    mesSelect.innerHTML = '<option value="">Selecione...</option>';
    gabSelect.innerHTML = '<option value="">Selecione...</option>';

    meses.forEach(m => mesSelect.innerHTML += `<option value="${m}">${m}</option>`);
    gabinetes.forEach(g => gabSelect.innerHTML += `<option value="${g}">${g}</option>`);

    mesSelect.addEventListener('change', atualizarPainel);
    gabSelect.addEventListener('change', atualizarPainel);
}

// ─── ATUALIZAÇÃO PRINCIPAL ──────────────────────────────────────────────────
function atualizarPainel() {
    const mes = document.getElementById('mesSelect').value.trim();
    const gab = document.getElementById('gabineteSelect').value.trim();

    ocultarTudo();

    if (!mes || !gab) return;

    // Dados filtrados
    const verbaMes = dadosVerbas.find(l => l['Mês']?.trim() === mes && l['Gabinete']?.trim() === gab) || {};
    const servidores = dadosServidores.filter(l => l['Mês']?.trim() === mes && l['Gabinete']?.trim() === gab);

    const tipo = classificarTipo(gab);

    atualizarTopbar(mes, gab, tipo);

    if (tipo === 'vereador') {
        renderizarVereador(gab, verbaMes, servidores);
    } else {
        renderizarEspecial(gab, tipo, verbaMes, servidores);
    }
}

// ─── CLASSIFICAÇÃO DE TIPO ──────────────────────────────────────────────────
function classificarTipo(gabinete) {
    const g = gabinete.trim();
    if (ESTRUTURA_ESPECIAL[g]) return 'mesa_diretora';
    // Gabinetes de vereadores geralmente seguem padrão "Gabinete XX" ou similar
    // Qualquer outro (blocos, lideranças) = bloco
    const ehVereador = /gabinete\s*\d+/i.test(g) || /vereador/i.test(g);
    if (ehVereador) return 'vereador';
    return 'bloco'; // blocos e lideranças
}

function ehEspecial(tipo) {
    return tipo === 'mesa_diretora' || tipo === 'bloco';
}

// ─── TOPBAR ─────────────────────────────────────────────────────────────────
function atualizarTopbar(mes, gab, tipo) {
    document.getElementById('topbarTitulo').textContent = gab;
    document.getElementById('topbarSub').textContent = 'Acompanhamento de lotação e orçamento';

    const badges = document.getElementById('topbarBadges');
    let tipoBadge = '';
    if (tipo === 'vereador') {
        tipoBadge = `<span class="badge badge-tipo-vereador">Gabinete de Vereador</span>`;
    } else if (tipo === 'mesa_diretora') {
        tipoBadge = `<span class="badge badge-tipo-especial">Mesa Diretora</span>`;
    } else {
        tipoBadge = `<span class="badge badge-tipo-especial">Bloco / Liderança</span>`;
    }
    badges.innerHTML = `<span class="badge badge-mes">${mes}</span>${tipoBadge}`;
}

// ─── PAINEL VEREADOR ────────────────────────────────────────────────────────
function renderizarVereador(gab, verbaMes, servidores) {
    document.getElementById('painelVereador').classList.remove('escondido');

    const responsavel = (verbaMes['Responsável'] || verbaMes['Responsavel'] || '').trim();

    // Calcula verba utilizada somando salários via tabela de cargos
    let verbaUtil = 0;
    servidores.forEach(s => {
        const cargo = (s['Cargo'] || '').trim();
        verbaUtil += tabelaCargos[cargo] || 0;
    });

    const saldo     = TETO_VEREADOR - verbaUtil;
    const pct       = TETO_VEREADOR > 0 ? Math.min((verbaUtil / TETO_VEREADOR) * 100, 100) : 0;
    const nServs    = servidores.filter(s => s['Nome do Servidor']?.trim()).length;
    const vagasLiv  = MAX_SERVIDORES - nServs;

    // Cards
    document.getElementById('vVerbaTotal').textContent  = moeda(TETO_VEREADOR);
    document.getElementById('vVerbaUtil').textContent   = moeda(verbaUtil);
    document.getElementById('vSaldo').textContent       = moeda(Math.abs(saldo));
    document.getElementById('vServidores').textContent  = `${nServs} / ${MAX_SERVIDORES}`;
    document.getElementById('vServidoresSub').textContent = vagasLiv > 0 ? `${vagasLiv} vaga(s) disponível` : 'sem vagas disponíveis';
    document.getElementById('vVerbaUtilSub').textContent = responsavel ? `Resp.: ${responsavel}` : 'soma dos salários';

    // Card saldo: cor dinâmica
    const cardSaldo = document.getElementById('vSaldo').closest('.card');
    cardSaldo.classList.remove('card-saldo-negativo');
    if (saldo < 0) {
        cardSaldo.classList.add('card-saldo-negativo');
        document.getElementById('vSaldoSub').textContent = 'acima do teto';
    } else {
        document.getElementById('vSaldoSub').textContent = 'disponível no teto';
    }

    // Barra de progresso
    const fill = document.getElementById('vProgressoFill');
    const pctEl = document.getElementById('vProgressoPct');
    fill.style.width = pct.toFixed(1) + '%';
    pctEl.textContent = pct.toFixed(1) + '%';
    fill.classList.remove('aviso', 'perigo');
    if (pct >= 100) fill.classList.add('perigo');
    else if (pct >= 85) fill.classList.add('aviso');

    // Alertas
    const alertas = [];
    const temCC1 = servidores.some(s => (s['Cargo'] || '').trim() === 'CC-1');
    if (!temCC1) {
        alertas.push({ tipo: 'erro', msg: 'CC-1 (Chefe de Gabinete) não está lotado. Este cargo é obrigatório.' });
    }
    if (nServs > MAX_SERVIDORES) {
        alertas.push({ tipo: 'erro', msg: `O gabinete possui ${nServs} servidores, acima do limite de ${MAX_SERVIDORES}.` });
    }
    if (verbaUtil > TETO_VEREADOR + TOLERANCIA) {
        alertas.push({ tipo: 'erro', msg: `Verba utilizada (${moeda(verbaUtil)}) excede o teto legal de ${moeda(TETO_VEREADOR)}.` });
    } else if (verbaUtil > TETO_VEREADOR) {
        alertas.push({ tipo: 'aviso', msg: `Verba dentro da margem de tolerância de R$ 0,13.` });
    }
    if (alertas.length === 0 && temCC1) {
        alertas.push({ tipo: 'ok', msg: 'Gabinete em conformidade com as regras legais.' });
    }
    renderizarAlertas('alertasVereador', alertas);

    // Tabela
    const tbody = document.getElementById('corpoTabelaVereador');
    const tfoot = document.getElementById('rodapeTabelaVereador');
    tbody.innerHTML = '';

    servidores.forEach(s => {
        const nome   = (s['Nome do Servidor'] || '').trim();
        const cargo  = (s['Cargo'] || '').trim();
        const sal    = tabelaCargos[cargo] || 0;
        if (nome) {
            tbody.innerHTML += `
                <tr>
                    <td>${nome}</td>
                    <td>${cargo || '—'}</td>
                    <td class="col-salario">${sal > 0 ? moeda(sal) : '—'}</td>
                </tr>`;
        }
    });

    tfoot.innerHTML = `
        <tr>
            <td colspan="2">Total</td>
            <td class="col-salario col-salario-total">${moeda(verbaUtil)}</td>
        </tr>`;
}

// ─── PAINEL ESPECIAL ────────────────────────────────────────────────────────
function renderizarEspecial(gab, tipo, verbaMes, servidores) {
    document.getElementById('painelEspecial').classList.remove('escondido');

    const responsavel = (verbaMes['Responsável'] || verbaMes['Responsavel'] || '').trim();
    document.getElementById('eResponsavel').textContent = responsavel || 'Responsável não informado';
    if (!responsavel) document.getElementById('eResponsavel').style.opacity = '0.5';
    else document.getElementById('eResponsavel').style.opacity = '1';

    // Define estrutura esperada de cargos
    let estrutura = [];
    if (tipo === 'mesa_diretora') {
        estrutura = ESTRUTURA_ESPECIAL[gab] || [];
    } else {
        // bloco / liderança: 1 vaga de CC-8
        estrutura = ['CC-8'];
    }

    // Mapeia servidores por cargo
    const ocupados = {};
    servidores.forEach(s => {
        const cargo = (s['Cargo'] || '').trim();
        const nome  = (s['Nome do Servidor'] || '').trim();
        if (cargo && nome) ocupados[cargo] = nome;
    });

    // Grade de cargos
    const grade = document.getElementById('gradeCargos');
    grade.innerHTML = '';
    estrutura.forEach(cc => {
        const nome = ocupados[cc];
        if (nome) {
            grade.innerHTML += `
                <div class="cargo-slot cargo-slot-ocupado">
                    <span class="cargo-slot-cc">${cc}</span>
                    <span class="cargo-slot-nome">${nome}</span>
                    <span class="cargo-slot-status">● Ocupado</span>
                </div>`;
        } else {
            grade.innerHTML += `
                <div class="cargo-slot cargo-slot-livre">
                    <span class="cargo-slot-cc">${cc}</span>
                    <span class="cargo-slot-nome">Vaga disponível</span>
                    <span class="cargo-slot-status">○ Livre</span>
                </div>`;
        }
    });

    // Alertas
    const alertas = [];
    const vagasLivres = estrutura.filter(cc => !ocupados[cc]);
    const vagasOcup   = estrutura.filter(cc =>  ocupados[cc]);

    if (tipo === 'bloco') {
        if (vagasLivres.length > 0) {
            alertas.push({ tipo: 'aviso', msg: 'O cargo CC-8 desta lotação está vago.' });
        } else {
            alertas.push({ tipo: 'ok', msg: 'Lotação regularmente ocupada.' });
        }
    } else {
        if (vagasLivres.length === estrutura.length) {
            alertas.push({ tipo: 'aviso', msg: 'Nenhum cargo desta lotação está ocupado.' });
        } else if (vagasLivres.length > 0) {
            alertas.push({ tipo: 'aviso', msg: `${vagasLivres.length} cargo(s) com vaga disponível: ${vagasLivres.join(', ')}.` });
        } else {
            alertas.push({ tipo: 'ok', msg: 'Todos os cargos da estrutura estão ocupados.' });
        }
    }
    renderizarAlertas('alertasEspecial', alertas);

    // Tabela (sem salários)
    const tbody = document.getElementById('corpoTabelaEspecial');
    tbody.innerHTML = '';
    servidores.forEach(s => {
        const nome  = (s['Nome do Servidor'] || '').trim();
        const cargo = (s['Cargo'] || '').trim();
        if (nome) {
            tbody.innerHTML += `<tr><td>${nome}</td><td>${cargo || '—'}</td></tr>`;
        }
    });
    if (!tbody.innerHTML) {
        tbody.innerHTML = `<tr><td colspan="2" style="color:var(--muted);font-style:italic;text-align:center">Nenhum servidor lotado neste período</td></tr>`;
    }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function ocultarTudo() {
    document.getElementById('estadoInicial').style.display   = 'none';
    document.getElementById('painelVereador').classList.add('escondido');
    document.getElementById('painelEspecial').classList.add('escondido');
    document.getElementById('topbarTitulo').textContent = 'Painel Orçamentário';
    document.getElementById('topbarSub').textContent    = 'Selecione uma lotação para visualizar os dados';
    document.getElementById('topbarBadges').innerHTML   = '';

    // Se nada selecionado, mostra estado inicial
    const mes = document.getElementById('mesSelect').value;
    const gab = document.getElementById('gabineteSelect').value;
    if (!mes || !gab) document.getElementById('estadoInicial').style.display = 'flex';
}

function renderizarAlertas(idEl, alertas) {
    const el = document.getElementById(idEl);
    el.innerHTML = '';
    alertas.forEach(a => {
        let icone = '';
        if (a.tipo === 'erro') {
            icone = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        } else if (a.tipo === 'aviso') {
            icone = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
        } else {
            icone = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        }
        el.innerHTML += `<div class="alerta alerta-${a.tipo}">${icone}<span>${a.msg}</span></div>`;
    });
}

function moeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setStatus(tipo, msg) {
    const dot = document.querySelector('.status-dot');
    const txt = document.getElementById('statusConexao');
    dot.className = 'status-dot ' + tipo;
    txt.textContent = msg;
}

// ─── START ───────────────────────────────────────────────────────────────────
iniciar();
