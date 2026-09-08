/* Armazenamento local (localStorage) — sem servidor e sem banco de dados. */
const Store = (() => {
  const CHAVE = 'barraca.config.v1';
  const CHAVE_PEDIDO = 'barraca.pedido.v1';
  const SENHA_PADRAO = 'admin';

  const padrao = () => ({
    empresa: {
      nome: 'GU HORTALIÇAS',
      telefone: '(11) 94014-3665',
      slogan: 'FRESCOR • QUALIDADE • SAÚDE',
      /* A chave PIX fica em branco de propósito: cada aparelho cadastra a
         sua em ⚙️, para o dado de pagamento não viajar dentro do código. */
      pixChave: '',
      pixTitular: '',
      logo: 'imagens/logo-gu.jpg'
    },
    atendentes: [],
    frequentes: [],         // produtos usados recentemente, para lançar com um toque
    adminHash: '',          // vazio = ainda usando a senha padrão
    proximoId: 1
  });

  function ler() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (!bruto) return padrao();
      return Object.assign(padrao(), JSON.parse(bruto));
    } catch {
      return padrao();
    }
  }

  let config = ler();

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(config));
    } catch {
      /* modo privado / cota cheia: a aplicação continua funcionando na sessão atual */
    }
  }

  /* --- hash da senha ---------------------------------------------------- */
  /* crypto.subtle não existe em contexto inseguro (http:// em rede local),
     por isso há um hash simples de reserva. Serve só para não guardar a
     senha em texto puro no navegador — não é segurança de servidor. */
  async function hash(texto) {
    const dados = new TextEncoder().encode('barraca::' + texto);
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', dados);
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (const b of dados) {
      h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + b + 7, 0x85ebca6b) >>> 0;
    }
    return 'fb' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  return {
    SENHA_PADRAO,

    get empresa() { return config.empresa; },
    get atendentes() { return config.atendentes; },
    get frequentes() { return config.frequentes; },

    /* Guarda os últimos produtos digitados para virarem atalhos na tela. */
    registrarProduto(nome) {
      nome = nome.trim();
      if (!nome) return;
      config.frequentes = [nome, ...config.frequentes.filter(p => p.toLowerCase() !== nome.toLowerCase())].slice(0, 12);
      salvar();
    },

    usandoSenhaPadrao() { return !config.adminHash; },

    async conferirSenha(senha) {
      if (!config.adminHash) return senha === SENHA_PADRAO;
      return await hash(senha) === config.adminHash;
    },

    async definirSenha(senha) {
      config.adminHash = await hash(senha);
      salvar();
    },

    atualizarEmpresa(dados) {
      Object.assign(config.empresa, dados);
      salvar();
    },

    adicionarAtendente(nome) {
      nome = nome.trim();
      if (!nome) return null;
      const existe = config.atendentes.some(a => a.nome.toLowerCase() === nome.toLowerCase());
      if (existe) return null;
      const atendente = { id: config.proximoId++, nome };
      config.atendentes.push(atendente);
      salvar();
      return atendente;
    },

    renomearAtendente(id, nome) {
      const atendente = config.atendentes.find(a => a.id === id);
      if (!atendente || !nome.trim()) return;
      atendente.nome = nome.trim();
      salvar();
    },

    removerAtendente(id) {
      config.atendentes = config.atendentes.filter(a => a.id !== id);
      salvar();
    },

    /* --- rascunho do pedido em andamento --------------------------------- */
    lerPedido() {
      try {
        return JSON.parse(localStorage.getItem(CHAVE_PEDIDO) || 'null');
      } catch {
        return null;
      }
    },

    salvarPedido(pedido) {
      try {
        localStorage.setItem(CHAVE_PEDIDO, JSON.stringify(pedido));
      } catch { /* ignora */ }
    },

    limparPedido() {
      try { localStorage.removeItem(CHAVE_PEDIDO); } catch { /* ignora */ }
    }
  };
})();
