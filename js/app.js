/* Ligação entre a tela e o pedido. Tudo roda no navegador, sem servidor. */
(() => {
  const $ = sel => document.querySelector(sel);
  const hoje = () => new Date().toISOString().slice(0, 10);

  const el = {
    cliente: $('#cliente'), endereco: $('#endereco'), data: $('#data'),
    atendente: $('#atendente'), avisoAtendente: $('#avisoAtendente'),
    formItem: $('#formItem'), itemDesc: $('#itemDesc'), itemQtd: $('#itemQtd'),
    itemUnidade: $('#itemUnidade'), itemValor: $('#itemValor'),
    listaItens: $('#listaItens'), listaVazia: $('#listaVazia'),
    taxaEntrega: $('#taxaEntrega'), totalGeral: $('#totalGeral'),
    badgeItens: $('#badgeItens'), canvas: $('#canvasPedido'),
    btnLimpar: $('#btnLimpar'), btnBaixar: $('#btnBaixar'),
    btnCompartilhar: $('#btnCompartilhar'), dicaCompartilhar: $('#dicaCompartilhar'),
    topbarNome: $('#topbarNome'), topbarSub: $('#topbarSub'), topbarLogo: $('#topbarLogo'),
    toast: $('#toast')
  };

  let pedido = Store.lerPedido() || { cliente: '', endereco: '', data: hoje(), atendenteId: null, itens: [], taxa: 0 };
  let logoImg = null;

  /* ---------- utilidades ---------- */
  let tempoToast;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => { el.toast.hidden = true; }, 2600);
  }

  function nomeAtendente() {
    const a = Store.atendentes.find(a => a.id === pedido.atendenteId);
    return a ? a.nome : '';
  }

  function dadosDoPedido() {
    return {
      cliente: pedido.cliente,
      endereco: pedido.endereco,
      data: pedido.data,
      atendente: nomeAtendente(),
      itens: pedido.itens,
      taxa: pedido.taxa,
      empresa: Store.empresa
    };
  }

  /* ---------- desenho ---------- */
  let pendente = false;
  function desenhar() {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      Receipt.render(el.canvas, dadosDoPedido(), { logo: logoImg });
    });
  }

  function salvar() {
    Store.salvarPedido(pedido);
  }

  /* ---------- itens ---------- */
  function totalItens() {
    return pedido.itens.reduce((s, i) => s + i.valor, 0);
  }

  function pintarItens() {
    el.listaItens.innerHTML = '';
    pedido.itens.forEach((item, i) => {
      const li = document.createElement('li');

      const info = document.createElement('div');
      info.className = 'item-info';
      const nome = document.createElement('span');
      nome.className = 'item-nome';
      nome.textContent = `${i + 1}. ${item.desc}`;
      const meta = document.createElement('span');
      meta.className = 'item-meta';
      meta.textContent = item.quantidade;
      info.append(nome, meta);

      const valor = document.createElement('span');
      valor.className = 'item-valor';
      valor.textContent = Fmt.moeda(item.valor);

      const remover = document.createElement('button');
      remover.type = 'button';
      remover.className = 'btn-remover';
      remover.textContent = '✕';
      remover.title = 'Remover item';
      remover.addEventListener('click', () => {
        pedido.itens.splice(i, 1);
        atualizar();
      });

      li.append(info, valor, remover);
      el.listaItens.append(li);
    });

    el.listaVazia.hidden = pedido.itens.length > 0;
    el.badgeItens.textContent = pedido.itens.length === 1 ? '1 item' : `${pedido.itens.length} itens`;
    el.totalGeral.textContent = Fmt.moeda(totalItens() + pedido.taxa);
  }

  function atualizar() {
    pintarItens();
    desenhar();
    salvar();
  }

  el.formItem.addEventListener('submit', ev => {
    ev.preventDefault();
    const desc = el.itemDesc.value.trim();
    const valor = Fmt.paraNumero(el.itemValor.value);
    if (!desc) return;
    if (valor <= 0) { toast('Informe o valor total do produto.'); el.itemValor.focus(); return; }

    const qtd = el.itemQtd.value.trim() || '1';
    const unidade = el.itemUnidade.value;
    const numero = Fmt.paraNumero(qtd);
    pedido.itens.push({
      desc,
      /* aceita número ("1,5") ou texto livre ("meia dúzia") */
      quantidade: (numero > 0 ? Fmt.numero(numero) : qtd) + (unidade ? ' ' + unidade : ''),
      valor
    });

    el.formItem.reset();
    el.itemUnidade.value = unidade;   // mantém a última unidade usada
    el.itemDesc.focus();
    atualizar();
  });

  /* ---------- campos do pedido ---------- */
  el.cliente.addEventListener('input', () => { pedido.cliente = el.cliente.value; atualizar(); });
  el.endereco.addEventListener('input', () => { pedido.endereco = el.endereco.value; atualizar(); });
  el.data.addEventListener('change', () => { pedido.data = el.data.value || hoje(); atualizar(); });
  el.atendente.addEventListener('change', () => { pedido.atendenteId = Number(el.atendente.value) || null; atualizar(); });
  el.taxaEntrega.addEventListener('input', () => { pedido.taxa = Fmt.paraNumero(el.taxaEntrega.value); atualizar(); });

  el.btnLimpar.addEventListener('click', () => {
    if (pedido.itens.length && !confirm('Começar um pedido novo? Os itens atuais serão apagados.')) return;
    const atendenteId = pedido.atendenteId;   // o atendente do turno continua o mesmo
    pedido = { cliente: '', endereco: '', data: hoje(), atendenteId, itens: [], taxa: 0 };
    Store.limparPedido();
    preencherCampos();
    atualizar();
    el.cliente.focus();
  });

  /* ---------- imagem ---------- */
  function nomeArquivo() {
    const cliente = (pedido.cliente || 'pedido').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pedido';
    return `pedido-${cliente}-${pedido.data}.png`;
  }

  function paraBlob() {
    return new Promise(resolve => el.canvas.toBlob(resolve, 'image/png'));
  }

  el.btnBaixar.addEventListener('click', async () => {
    const blob = await paraBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });

  el.btnCompartilhar.addEventListener('click', async () => {
    const blob = await paraBlob();
    if (!blob) return;
    const arquivo = new File([blob], nomeArquivo(), { type: 'image/png' });
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Pedido' });
      } catch (e) {
        if (e.name !== 'AbortError') toast('Não foi possível compartilhar.');
      }
    } else {
      el.btnBaixar.click();
      toast('Imagem baixada — envie pelo WhatsApp.');
    }
  });

  /* ---------- administrador ---------- */
  const dlg = $('#dlgAdmin');
  const adm = {
    login: $('#adminLogin'), painel: $('#adminPainel'),
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

      const info = document.createElement('div');
      info.className = 'item-info';
      const nome = document.createElement('span');
      nome.className = 'item-nome';
      nome.textContent = a.nome;
      info.append(nome);

      const editar = document.createElement('button');
      editar.type = 'button';
      editar.className = 'btn btn-fantasma';
      editar.textContent = 'Editar';
      editar.addEventListener('click', () => {
        const novo = prompt('Novo nome do atendente:', a.nome);
        if (novo === null) return;
        Store.renomearAtendente(a.id, novo);
        pintarAtendentesAdmin();
        pintarSelectAtendentes();
        desenhar();
      });

      const remover = document.createElement('button');
      remover.type = 'button';
      remover.className = 'btn-remover';
      remover.textContent = '✕';
      remover.title = 'Remover atendente';
      remover.addEventListener('click', () => {
        if (!confirm(`Remover o atendente "${a.nome}"?`)) return;
        Store.removerAtendente(a.id);
        if (pedido.atendenteId === a.id) pedido.atendenteId = null;
        pintarAtendentesAdmin();
        pintarSelectAtendentes();
        atualizar();
      });

      li.append(info, editar, remover);
      adm.lista.append(li);
    });
  }

  function abrirPainelAdmin() {
    adm.login.hidden = true;
    adm.painel.hidden = false;
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
    adm.erro.hidden = true;
    adm.senha.value = '';
    adm.dicaPadrao.textContent = Store.usandoSenhaPadrao()
      ? `Senha padrão: "${Store.SENHA_PADRAO}" — troque no painel depois de entrar.`
      : '';
    dlg.showModal();
    adm.senha.focus();
  });

  async function tentarEntrar() {
    if (await Store.conferirSenha(adm.senha.value)) {
      adm.erro.hidden = true;
      abrirPainelAdmin();
    } else {
      adm.erro.hidden = false;
      adm.senha.select();
    }
  }
  $('#btnEntrar').addEventListener('click', tentarEntrar);
  adm.senha.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); tentarEntrar(); } });

  $('#btnSair').addEventListener('click', () => dlg.close());

  $('#btnAddAtendente').addEventListener('click', () => {
    const nome = adm.novo.value.trim();
    if (!nome) return;
    if (!Store.adicionarAtendente(nome)) { toast('Esse atendente já está cadastrado.'); return; }
    adm.novo.value = '';
    pintarAtendentesAdmin();
    pintarSelectAtendentes();
    avisoSalvo();
  });
  adm.novo.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('#btnAddAtendente').click(); } });

  for (const [campo, chave] of [[adm.nome, 'nome'], [adm.telefone, 'telefone'], [adm.slogan, 'slogan'],
                                [adm.pixChave, 'pixChave'], [adm.pixTitular, 'pixTitular']]) {
    campo.addEventListener('input', () => {
      Store.atualizarEmpresa({ [chave]: campo.value });
      pintarTopo();
      desenhar();
    });
  }

  /* Reduz a logo antes de guardar: localStorage tem espaço limitado. */
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

  /* ---------- montagem inicial ---------- */
  function pintarSelectAtendentes() {
    const atual = pedido.atendenteId;
    el.atendente.innerHTML = '';
    const vazio = document.createElement('option');
    vazio.value = '';
    vazio.textContent = Store.atendentes.length ? '— selecione —' : 'nenhum atendente cadastrado';
    el.atendente.append(vazio);
    Store.atendentes.forEach(a => {
      const op = document.createElement('option');
      op.value = a.id;
      op.textContent = a.nome;
      el.atendente.append(op);
    });
    el.atendente.value = Store.atendentes.some(a => a.id === atual) ? String(atual) : '';
    pedido.atendenteId = Number(el.atendente.value) || null;
    el.atendente.disabled = !Store.atendentes.length;
    el.avisoAtendente.hidden = Store.atendentes.length > 0;
  }

  function pintarTopo() {
    const e = Store.empresa;
    el.topbarNome.textContent = e.nome || 'Minha Barraca';
    el.topbarSub.textContent = e.telefone || 'Pedidos da feira';
    el.topbarLogo.innerHTML = '';
    if (e.logo) {
      const img = new Image();
      img.src = e.logo;
      img.alt = '';
      el.topbarLogo.append(img);
    } else {
      el.topbarLogo.textContent = '🥬';
    }
    document.title = `Pedidos — ${e.nome || 'Minha Barraca'}`;
  }

  function preencherCampos() {
    el.cliente.value = pedido.cliente || '';
    el.endereco.value = pedido.endereco || '';
    el.data.value = pedido.data || hoje();
    el.taxaEntrega.value = pedido.taxa ? String(pedido.taxa).replace('.', ',') : '';
  }

  async function carregarLogo() {
    logoImg = await Receipt.carregarLogo(Store.empresa.logo);
  }

  el.dicaCompartilhar.textContent = navigator.canShare
    ? 'No celular, "Compartilhar" abre o WhatsApp direto com a foto do pedido.'
    : 'Use "Baixar imagem" e envie a foto pelo WhatsApp.';

  preencherCampos();
  pintarSelectAtendentes();
  pintarTopo();
  pintarItens();
  carregarLogo().then(desenhar);
})();
