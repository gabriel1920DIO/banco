/* Liga a tela ao pedido. Tudo roda no navegador, sem servidor. */
(() => {
  const $ = sel => document.querySelector(sel);
  const hoje = () => new Date().toISOString().slice(0, 10);
  const UNIDADES = ['un', 'kg', 'cx', 'mç', 'dz', 'bdj'];
  const UNIDADES_EXTRA = ['g', 'ctla', 'pct', 'sc', 'L', 'pé'];

  const el = {
    cliente: $('#cliente'), endereco: $('#endereco'), data: $('#data'),
    chipsAtendente: $('#chipsAtendente'), avisoAtendente: $('#avisoAtendente'),
    formItem: $('#formItem'), itemDesc: $('#itemDesc'), itemQtd: $('#itemQtd'),
    itemValor: $('#itemValor'), chipsUnidade: $('#chipsUnidade'), chipsFrequentes: $('#chipsFrequentes'),
    listaItens: $('#listaItens'), listaVazia: $('#listaVazia'), contadorItens: $('#contadorItens'),
    taxaEntrega: $('#taxaEntrega'), totalGeral: $('#totalGeral'), pillItens: $('#pillItens'),
    canvas: $('#canvasPedido'), btnAcao: $('#btnAcao'),
    listaSeparar: $('#listaSeparar'), separarVazio: $('#separarVazio'),
    sepBarra: $('#sepBarra'), sepTexto: $('#sepTexto'), pillSeparar: $('#pillSeparar'),
    mensagem: $('#mensagem'),
    topoNome: $('#topoNome'), topoSub: $('#topoSub'), topoLogo: $('#topoLogo'),
    toast: $('#toast')
  };

  let pedido = Store.lerPedido() || { cliente: '', endereco: '', data: hoje(), atendenteId: null, itens: [], taxa: 0 };
  let unidadeAtual = 'un';
  let logoImg = null;
  let proximoItemId = 1;

  /* Cada item ganha uma identidade: dois produtos de mesmo nome não se
     confundem na hora de animar a lista de separação. */
  function garantirIds() {
    pedido.itens.forEach(i => {
      if (i.id) proximoItemId = Math.max(proximoItemId, i.id + 1);
      else i.id = proximoItemId++;
    });
  }

  /* ===================== utilidades ===================== */
  let tempoToast;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => { el.toast.hidden = true; }, 3000);
  }

  function vibrar(ms = 12) {
    if (navigator.vibrate) try { navigator.vibrate(ms); } catch { /* ignora */ }
  }

  function moedaEditavel(valor) {
    return valor ? valor.toFixed(2).replace('.', ',') : '';
  }

  function nomeAtendente() {
    const a = Store.atendentes.find(a => a.id === pedido.atendenteId);
    return a ? a.nome : '';
  }

  function faltamPrecos() {
    return pedido.itens.filter(i => !i.valor).length;
  }

  /* ===================== desenho da foto ===================== */
  let pendente = false;
  function desenhar() {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      Receipt.render(el.canvas, {
        cliente: pedido.cliente, endereco: pedido.endereco, data: pedido.data,
        atendente: nomeAtendente(), itens: pedido.itens, taxa: pedido.taxa,
        empresa: Store.empresa
      }, { logo: logoImg });
      prepararArquivo();
    });
  }

  function separados() {
    return pedido.itens.filter(i => i.separado).length;
  }

  function atualizarTotais() {
    const soma = pedido.itens.reduce((s, i) => s + i.valor, 0) + pedido.taxa;
    el.totalGeral.textContent = Fmt.moeda(soma);
    el.contadorItens.textContent = pedido.itens.length;
    el.pillItens.textContent = pedido.itens.length;
    el.listaVazia.hidden = pedido.itens.length > 0;

    const total = pedido.itens.length;
    const prontos = separados();
    const faltamItens = total - prontos;
    el.pillSeparar.textContent = total ? `${prontos}/${total}` : '0';
    el.pillSeparar.classList.toggle('pill-fraca', faltamItens > 0);
    el.sepTexto.textContent = `${prontos} de ${total} separado${total === 1 ? '' : 's'}`;
    el.sepBarra.style.width = total ? `${(prontos / total) * 100}%` : '0';
    el.separarVazio.hidden = total > 0;

    const vista = document.body.dataset.vista;
    const faltam = faltamPrecos();
    if (vista === 'foto') {
      el.btnAcao.textContent = 'Compartilhar';
      el.btnAcao.classList.remove('botao-alerta');
    } else if (vista === 'separar') {
      el.btnAcao.textContent = faltamItens ? `Faltam ${faltamItens}` : 'Tudo separado';
      el.btnAcao.classList.toggle('botao-alerta', faltamItens > 0);
    } else {
      el.btnAcao.textContent = faltam ? `Falta${faltam > 1 ? 'm' : ''} ${faltam} preço${faltam > 1 ? 's' : ''}` : 'Ver foto';
      el.btnAcao.classList.toggle('botao-alerta', faltam > 0);
    }
  }

  /* ===================== separação ===================== */
  /* Marcados sobem para o topo, na ordem em que foram separados. */
  function ordemSeparacao() {
    return [...pedido.itens]
      .map((item, indice) => ({ item, indice }))
      .sort((a, b) => {
        if (a.item.separado && b.item.separado) return (a.item.separadoEm || 0) - (b.item.separadoEm || 0);
        if (a.item.separado !== b.item.separado) return a.item.separado ? -1 : 1;
        return a.indice - b.indice;
      })
      .map(x => x.item);
  }

  function pintarSeparacao() {
    garantirIds();
    el.listaSeparar.innerHTML = '';
    ordemSeparacao().forEach(item => {
      const li = document.createElement('li');
      li.dataset.id = item.id;
      const rotulo = document.createElement('label');
      rotulo.className = 'linha-sep' + (item.separado ? ' marcado' : '');

      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = !!item.separado;
      caixa.addEventListener('change', () => alternarSeparado(item, caixa.checked));

      const marca = document.createElement('span');
      marca.className = 'marca';

      const info = document.createElement('div');
      info.className = 'sep-info';
      const nome = document.createElement('span');
      nome.className = 'sep-nome';
      nome.textContent = item.desc;
      const qtd = document.createElement('span');
      qtd.className = 'sep-qtd';
      qtd.textContent = item.quantidade;
      info.append(nome, qtd);

      const valor = document.createElement('span');
      valor.className = 'sep-valor';
      valor.textContent = item.valor ? Fmt.moeda(item.valor) : '';

      rotulo.append(caixa, marca, info, valor);
      li.append(rotulo);
      el.listaSeparar.append(li);
    });
    atualizarTotais();
  }

  /* Guarda onde cada linha estava, redesenha e desliza da posição antiga
     para a nova — assim dá para acompanhar o item subindo. */
  function animarReordenacao(redesenhar) {
    const antes = new Map();
    el.listaSeparar.querySelectorAll('li').forEach(li => antes.set(li.dataset.id, li.getBoundingClientRect().top));

    redesenhar();

    if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.listaSeparar.querySelectorAll('li').forEach(li => {
        const topoAntigo = antes.get(li.dataset.id);
        if (topoAntigo === undefined) return;
        const delta = topoAntigo - li.getBoundingClientRect().top;
        if (!delta || !li.animate) return;
        li.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }],
                   { duration: 260, easing: 'cubic-bezier(.2,.7,.3,1)' });
      });
    }
  }

  function alternarSeparado(item, marcado) {
    item.separado = marcado;
    item.separadoEm = marcado ? Date.now() : 0;
    vibrar(marcado ? 18 : 8);
    animarReordenacao(pintarSeparacao);
    Store.salvarPedido(pedido);
    if (marcado && separados() === pedido.itens.length) toast('Pedido separado! 🎉');
  }

  $('#btnDesmarcar').addEventListener('click', () => {
    pedido.itens.forEach(i => { i.separado = false; i.separadoEm = 0; });
    animarReordenacao(pintarSeparacao);
    Store.salvarPedido(pedido);
  });

  $('#btnSeparar').addEventListener('click', () => {
    if (!pedido.itens.length) { toast('Adicione os produtos primeiro.'); return; }
    irPara('separar');
  });

  function atualizar() {
    pintarSeparacao();
    desenhar();
    Store.salvarPedido(pedido);
  }

  /* ===================== lista de itens ===================== */
  /* Cada linha tem os três campos editáveis: dá para colar a mensagem do
     cliente, deixar tudo montado e depois só tocar em cada preço. */
  function pintarItens() {
    el.listaItens.innerHTML = '';

    pedido.itens.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'item';

      const desc = document.createElement('input');
      desc.className = 'item-desc';
      desc.value = item.desc;
      desc.setAttribute('aria-label', 'Produto');
      desc.addEventListener('input', () => { item.desc = desc.value; atualizar(); });

      const linha = document.createElement('div');
      linha.className = 'item-linha';

      const qtd = document.createElement('input');
      qtd.className = 'item-qtd';
      qtd.value = item.quantidade;
      qtd.setAttribute('aria-label', 'Quantidade');
      qtd.addEventListener('input', () => { item.quantidade = qtd.value; atualizar(); });

      const moeda = document.createElement('div');
      moeda.className = 'moeda moeda-item';
      const prefixo = document.createElement('span');
      prefixo.className = 'moeda-prefixo';
      prefixo.textContent = 'R$';
      const valor = document.createElement('input');
      valor.className = 'item-valor';
      valor.inputMode = 'decimal';
      valor.placeholder = '0,00';
      valor.value = moedaEditavel(item.valor);
      valor.setAttribute('aria-label', 'Valor total do produto');
      valor.addEventListener('input', () => {
        item.valor = Fmt.paraNumero(valor.value);
        li.classList.toggle('sem-preco', !item.valor);
        atualizar();
      });
      valor.addEventListener('blur', () => { valor.value = moedaEditavel(item.valor); });
      /* Enter pula para o preço do próximo item — bom para preencher em série. */
      valor.addEventListener('keydown', ev => {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        const campos = [...el.listaItens.querySelectorAll('.item-valor')];
        (campos[campos.indexOf(valor) + 1] || valor).focus();
      });
      moeda.append(prefixo, valor);

      const remover = document.createElement('button');
      remover.type = 'button';
      remover.className = 'botao-remover';
      remover.textContent = '✕';
      remover.setAttribute('aria-label', `Remover ${item.desc}`);
      remover.addEventListener('click', () => {
        pedido.itens.splice(i, 1);
        vibrar();
        pintarItens();
        atualizar();
      });

      linha.append(qtd, moeda, remover);
      li.append(desc, linha);
      li.classList.toggle('sem-preco', !item.valor);
      el.listaItens.append(li);
    });

    atualizarTotais();
  }

  function focarPrimeiroPrecoVazio() {
    const campo = [...el.listaItens.querySelectorAll('.item-valor')].find(c => !Fmt.paraNumero(c.value));
    if (campo) { campo.focus(); campo.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return !!campo;
  }

  /* ===================== adicionar um produto ===================== */
  el.formItem.addEventListener('submit', ev => {
    ev.preventDefault();
    const desc = el.itemDesc.value.trim();
    if (!desc) { el.itemDesc.focus(); return; }

    const valor = Fmt.paraNumero(el.itemValor.value);
    const bruta = el.itemQtd.value.trim() || '1';
    const numero = Fmt.paraNumero(bruta);

    pedido.itens.push({
      desc,
      /* aceita número ("1,5") ou texto livre ("meia dúzia") */
      quantidade: (numero > 0 ? Fmt.numero(numero) : bruta) + (unidadeAtual ? ' ' + unidadeAtual : ''),
      valor,
      separado: false
    });
    Store.registrarProduto(desc);

    el.itemDesc.value = '';
    el.itemValor.value = '';
    el.itemQtd.value = '1';
    el.itemDesc.focus();
    vibrar();
    pintarFrequentes();
    pintarItens();
    atualizar();
  });

  el.itemValor.addEventListener('blur', () => {
    const v = Fmt.paraNumero(el.itemValor.value);
    el.itemValor.value = v ? moedaEditavel(v) : '';
  });

  $('#btnMenos').addEventListener('click', () => passo(-1));
  $('#btnMais').addEventListener('click', () => passo(1));
  function passo(delta) {
    const atual = Fmt.paraNumero(el.itemQtd.value) || 0;
    const novo = Math.max(0, Math.round((atual + delta) * 1000) / 1000);
    el.itemQtd.value = Fmt.numero(novo || 1);
    vibrar(8);
  }

  /* ===================== mensagem do cliente ===================== */
  $('#btnLerMensagem').addEventListener('click', () => {
    const texto = el.mensagem.value;
    if (!texto.trim()) { el.mensagem.focus(); return; }

    const lido = Parser.ler(texto);
    if (!lido.itens.length) {
      toast('Não reconheci nenhum produto nessa mensagem.');
      return;
    }

    lido.itens.forEach(i => pedido.itens.push({ desc: i.desc, quantidade: i.quantidade, valor: 0, separado: false }));
    if (lido.cliente && !pedido.cliente) { pedido.cliente = lido.cliente; el.cliente.value = lido.cliente; }
    if (lido.endereco && !pedido.endereco) {
      pedido.endereco = lido.endereco;
      el.endereco.value = lido.endereco;
      $('#detalhesExtra').open = true;
    }

    el.mensagem.value = '';
    modo('um');
    vibrar(20);
    pintarItens();
    atualizar();
    toast(`${lido.itens.length} produto${lido.itens.length > 1 ? 's' : ''} na lista — agora coloque os preços.`);
    setTimeout(focarPrimeiroPrecoVazio, 350);
  });

  $('#btnLimparMensagem').addEventListener('click', () => { el.mensagem.value = ''; el.mensagem.focus(); });

  /* Um formulário por vez: a tela do celular fica curta e clara. */
  function modo(qual) {
    el.formItem.hidden = qual !== 'um';
    $('#painelMensagem').hidden = qual !== 'mensagem';
    document.querySelectorAll('.alt').forEach(a => a.setAttribute('aria-selected', String(a.dataset.modo === qual)));
  }
  document.querySelectorAll('.alt').forEach(a => a.addEventListener('click', () => {
    modo(a.dataset.modo);
    vibrar(8);
  }));

  /* ===================== campos do pedido ===================== */
  el.cliente.addEventListener('input', () => { pedido.cliente = el.cliente.value; atualizar(); });
  el.endereco.addEventListener('input', () => { pedido.endereco = el.endereco.value; atualizar(); });
  el.data.addEventListener('change', () => { pedido.data = el.data.value || hoje(); atualizar(); });
  el.taxaEntrega.addEventListener('input', () => { pedido.taxa = Fmt.paraNumero(el.taxaEntrega.value); atualizar(); });
  el.taxaEntrega.addEventListener('blur', () => { el.taxaEntrega.value = moedaEditavel(pedido.taxa); });

  $('#btnLimpar').addEventListener('click', () => {
    if (pedido.itens.length && !confirm('Começar um pedido novo? Os itens atuais serão apagados.')) return;
    const atendenteId = pedido.atendenteId;   // o atendente do turno continua o mesmo
    pedido = { cliente: '', endereco: '', data: hoje(), atendenteId, itens: [], taxa: 0 };
    Store.limparPedido();
    preencherCampos();
    pintarItens();
    atualizar();
    irPara('pedido');
    el.cliente.focus();
  });

  /* ===================== abas e barra ===================== */
  function irPara(vista) {
    document.body.dataset.vista = vista;
    document.querySelectorAll('.aba').forEach(a => a.setAttribute('aria-selected', String(a.dataset.ir === vista)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    atualizarTotais();
  }
  document.querySelectorAll('.aba').forEach(a => a.addEventListener('click', () => irPara(a.dataset.ir)));
  $('#btnVoltar').addEventListener('click', () => irPara('pedido'));

  el.btnAcao.addEventListener('click', () => {
    const vista = document.body.dataset.vista;
    if (vista === 'foto') { $('#btnCompartilhar').click(); return; }
    if (vista === 'separar') {
      const falta = el.listaSeparar.querySelector('.linha-sep:not(.marcado)');
      if (falta) { falta.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      irPara('foto');
      return;
    }
    if (!pedido.itens.length) { toast('Adicione pelo menos um produto.'); return; }
    if (faltamPrecos()) {
      toast('Coloque o preço de todos os produtos.');
      focarPrimeiroPrecoVazio();
      return;
    }
    irPara('foto');
  });

  /* ===================== imagem ===================== */
  function nomeArquivo() {
    const cliente = (pedido.cliente || 'pedido').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pedido';
    return `pedido-${cliente}-${pedido.data}.png`;
  }

  const paraBlob = () => new Promise(r => el.canvas.toBlob(r, 'image/png'));

  /* O Safari do iPhone só aceita navigator.share dentro do toque: se houver
     qualquer espera antes, ele recusa. Por isso a imagem é preparada assim
     que o pedido muda e o botão usa o arquivo já pronto. */
  let arquivoPronto = null;
  async function prepararArquivo() {
    const blob = await paraBlob();
    arquivoPronto = blob ? new File([blob], nomeArquivo(), { type: 'image/png' }) : null;
    return arquivoPronto;
  }

  function baixarArquivo(arquivo) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivo.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  $('#btnBaixar').addEventListener('click', async () => {
    const arquivo = arquivoPronto || await prepararArquivo();
    if (arquivo) baixarArquivo(arquivo);
  });

  $('#btnCompartilhar').addEventListener('click', ev => {
    const arquivo = arquivoPronto;
    if (arquivo && navigator.canShare?.({ files: [arquivo] })) {
      navigator.share({ files: [arquivo], title: 'Pedido' })
        .catch(e => { if (e.name !== 'AbortError') toast('Não foi possível compartilhar.'); });
      return;
    }
    /* Sem compartilhamento de arquivo (ou imagem ainda sendo preparada): baixa. */
    prepararArquivo().then(pronto => {
      if (!pronto) return;
      baixarArquivo(pronto);
      toast('Imagem salva — envie pelo WhatsApp.');
    });
  });

  /* ===================== chips ===================== */
  function chip(texto, aoTocar, marcado) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = texto;
    if (marcado !== undefined) b.setAttribute('aria-pressed', String(marcado));
    b.addEventListener('click', () => { vibrar(8); aoTocar(); });
    return b;
  }

  function pintarAtendentes() {
    el.chipsAtendente.innerHTML = '';
    if (!Store.atendentes.some(a => a.id === pedido.atendenteId)) pedido.atendenteId = null;
    Store.atendentes.forEach(a => {
      el.chipsAtendente.append(chip(a.nome, () => {
        pedido.atendenteId = pedido.atendenteId === a.id ? null : a.id;
        pintarAtendentes();
        atualizar();
      }, pedido.atendenteId === a.id));
    });
    el.chipsAtendente.hidden = !Store.atendentes.length;
    el.avisoAtendente.hidden = Store.atendentes.length > 0;
  }

  let todasUnidades = false;
  function pintarUnidades() {
    el.chipsUnidade.innerHTML = '';
    const lista = todasUnidades ? [...UNIDADES, ...UNIDADES_EXTRA] : UNIDADES;
    if (!lista.includes(unidadeAtual)) lista.push(unidadeAtual);
    lista.forEach(u => {
      el.chipsUnidade.append(chip(u, () => { unidadeAtual = u; pintarUnidades(); }, unidadeAtual === u));
    });
    if (!todasUnidades) {
      const mais = chip('mais…', () => { todasUnidades = true; pintarUnidades(); });
      mais.classList.add('chip-fraco');
      el.chipsUnidade.append(mais);
    }
  }

  function pintarFrequentes() {
    el.chipsFrequentes.innerHTML = '';
    Store.frequentes.forEach(nome => {
      const c = chip(nome, () => { el.itemDesc.value = nome; el.itemValor.focus(); });
      c.classList.add('chip-fraco');
      el.chipsFrequentes.append(c);
    });
    el.chipsFrequentes.hidden = !Store.frequentes.length;
  }

  /* ===================== administrador ===================== */
  const dlg = $('#dlgAdmin');
  const adm = {
    login: $('#adminLogin'), painel: $('#adminPainel'), titulo: $('#folhaTitulo'),
    senha: $('#adminSenha'), erro: $('#adminErro'), ok: $('#adminOk'),
    lista: $('#listaAtendentes'), novo: $('#novoAtendente'),
    nome: $('#cfgNome'), telefone: $('#cfgTelefone'), slogan: $('#cfgSlogan'),
    pixChave: $('#cfgPixChave'), pixTitular: $('#cfgPixTitular'), logo: $('#cfgLogo'),
    senha1: $('#cfgSenha1'), senha2: $('#cfgSenha2'), dicaPadrao: $('#dicaSenhaPadrao')
  };

  function avisoSalvo() {
    adm.ok.hidden = false;
    clearTimeout(avisoSalvo.t);
    avisoSalvo.t = setTimeout(() => { adm.ok.hidden = true; }, 2000);
  }

  function pintarAtendentesAdmin() {
    adm.lista.innerHTML = '';
    if (!Store.atendentes.length) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="item-meta">Nenhum atendente cadastrado.</span>';
      adm.lista.append(li);
      return;
    }
    Store.atendentes.forEach(a => {
      const li = document.createElement('li');

      const nome = document.createElement('input');
      nome.className = 'item-desc';
      nome.value = a.nome;
      nome.setAttribute('aria-label', 'Nome do atendente');
      nome.addEventListener('change', () => {
        Store.renomearAtendente(a.id, nome.value);
        pintarAtendentes();
        atualizar();
      });

      const remover = document.createElement('button');
      remover.type = 'button';
      remover.className = 'botao-remover';
      remover.textContent = '✕';
      remover.setAttribute('aria-label', `Remover ${a.nome}`);
      remover.addEventListener('click', () => {
        if (!confirm(`Remover o atendente "${a.nome}"?`)) return;
        Store.removerAtendente(a.id);
        pintarAtendentesAdmin();
        pintarAtendentes();
        atualizar();
      });

      li.append(nome, remover);
      adm.lista.append(li);
    });
  }

  function abrirPainelAdmin() {
    adm.login.hidden = true;
    adm.painel.hidden = false;
    adm.titulo.textContent = 'Administração';
    const e = Store.empresa;
    adm.nome.value = e.nome || '';
    adm.telefone.value = e.telefone || '';
    adm.slogan.value = e.slogan || '';
    adm.pixChave.value = e.pixChave || '';
    adm.pixTitular.value = e.pixTitular || '';
    pintarAtendentesAdmin();
  }

  $('#btnAdmin').addEventListener('click', () => {
    adm.login.hidden = false;
    adm.painel.hidden = true;
    adm.titulo.textContent = 'Administrador';
    adm.erro.hidden = true;
    adm.senha.value = '';
    adm.dicaPadrao.textContent = Store.usandoSenhaPadrao()
      ? `Senha padrão: "${Store.SENHA_PADRAO}" — troque depois de entrar.`
      : '';
    dlg.showModal();
    document.documentElement.classList.add('sem-rolagem');
    adm.senha.focus();
  });

  $('#btnFechar').addEventListener('click', () => dlg.close());
  $('#btnSair').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => document.documentElement.classList.remove('sem-rolagem'));

  async function tentarEntrar() {
    if (await Store.conferirSenha(adm.senha.value)) {
      adm.erro.hidden = true;
      abrirPainelAdmin();
    } else {
      adm.erro.hidden = false;
      adm.senha.select();
      vibrar(40);
    }
  }
  $('#btnEntrar').addEventListener('click', tentarEntrar);
  adm.senha.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); tentarEntrar(); } });

  $('#btnAddAtendente').addEventListener('click', () => {
    const nome = adm.novo.value.trim();
    if (!nome) return;
    if (!Store.adicionarAtendente(nome)) { toast('Esse atendente já está cadastrado.'); return; }
    adm.novo.value = '';
    pintarAtendentesAdmin();
    pintarAtendentes();
    avisoSalvo();
  });
  adm.novo.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); $('#btnAddAtendente').click(); }
  });

  for (const [campo, chave] of [[adm.nome, 'nome'], [adm.telefone, 'telefone'], [adm.slogan, 'slogan'],
                                [adm.pixChave, 'pixChave'], [adm.pixTitular, 'pixTitular']]) {
    campo.addEventListener('input', () => {
      Store.atualizarEmpresa({ [chave]: campo.value });
      pintarTopo();
      desenhar();
    });
  }

  /* Reduz a logo antes de guardar: o armazenamento do navegador é pequeno. */
  adm.logo.addEventListener('change', () => {
    const arquivo = adm.logo.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        const lado = 400;
        const c = document.createElement('canvas');
        c.width = c.height = lado;
        const ctx = c.getContext('2d');
        const razao = Math.max(lado / img.width, lado / img.height);
        const w = img.width * razao, h = img.height * razao;
        ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
        Store.atualizarEmpresa({ logo: c.toDataURL('image/jpeg', .85) });
        carregarLogo().then(() => { pintarTopo(); desenhar(); avisoSalvo(); });
      };
      img.onerror = () => toast('Não foi possível ler a imagem.');
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });

  $('#btnRemoverLogo').addEventListener('click', () => {
    Store.atualizarEmpresa({ logo: '' });
    adm.logo.value = '';
    carregarLogo().then(() => { pintarTopo(); desenhar(); avisoSalvo(); });
  });

  $('#btnTrocarSenha').addEventListener('click', async () => {
    const s1 = adm.senha1.value, s2 = adm.senha2.value;
    if (s1.length < 4) { toast('A senha precisa ter pelo menos 4 caracteres.'); return; }
    if (s1 !== s2) { toast('As senhas não são iguais.'); return; }
    await Store.definirSenha(s1);
    adm.senha1.value = adm.senha2.value = '';
    avisoSalvo();
    toast('Senha alterada.');
  });

  /* ===================== montagem inicial ===================== */
  function pintarTopo() {
    const e = Store.empresa;
    el.topoNome.textContent = e.nome || 'Minha Barraca';
    el.topoSub.textContent = e.telefone || 'Pedidos da feira';
    el.topoLogo.innerHTML = '';
    if (e.logo) {
      const img = new Image();
      img.src = e.logo;
      img.alt = '';
      el.topoLogo.append(img);
    } else {
      el.topoLogo.textContent = '🥬';
    }
    document.title = `Pedidos — ${e.nome || 'Minha Barraca'}`;
  }

  function preencherCampos() {
    el.cliente.value = pedido.cliente || '';
    el.endereco.value = pedido.endereco || '';
    el.data.value = pedido.data || hoje();
    el.taxaEntrega.value = moedaEditavel(pedido.taxa);
  }

  async function carregarLogo() {
    logoImg = await Receipt.carregarLogo(Store.empresa.logo);
  }

  $('#dicaCompartilhar').textContent = navigator.canShare
    ? 'No celular, "Compartilhar" abre o WhatsApp já com a foto.'
    : 'Use "Baixar" e envie a foto pelo WhatsApp.';

  preencherCampos();
  pintarAtendentes();
  pintarUnidades();
  pintarFrequentes();
  pintarTopo();
  pintarItens();
  pintarSeparacao();
  carregarLogo().then(desenhar);

  /* Instalável na tela inicial e funcionando sem internet na feira. */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
