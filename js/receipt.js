/* Desenha o pedido em um <canvas> — é essa imagem que vira a "foto" do pedido. */
const Fmt = {
  moeda(v) {
    return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  numero(v) {
    const n = Number(v) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/[.,]$/, '').replace('.', ',');
  },
  data(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  },
  /* Aceita "12,50", "12.50" ou "1.234,50" e devolve número. */
  paraNumero(texto) {
    if (typeof texto === 'number') return texto;
    const limpo = String(texto || '').trim().replace(/[^\d,.-]/g, '');
    if (!limpo) return 0;
    const usaVirgula = limpo.lastIndexOf(',') > limpo.lastIndexOf('.');
    const normal = usaVirgula ? limpo.replace(/\./g, '').replace(',', '.') : limpo.replace(/,/g, '');
    const n = parseFloat(normal);
    return Number.isFinite(n) ? n : 0;
  }
};

const Receipt = (() => {
  const L = 1000;                 // largura lógica
  const M = 36;                   // margem
  const VERDE = '#14532d';
  const VERDE_CLARO = '#eef5ef';
  const TEXTO = '#1b2420';
  const FRACO = '#6b7a71';
  const BORDA = '#c9d4cb';
  const FONTE = 'Arial, Helvetica, sans-serif';

  const COL = { item: 80, quant: 170, valor: 230 };
  COL.desc = L - 2 * M - COL.item - COL.quant - COL.valor;

  function fonte(peso, tam) { return `${peso} ${tam}px ${FONTE}`; }

  function quebrar(ctx, texto, largura) {
    const palavras = String(texto || '').split(/\s+/).filter(Boolean);
    if (!palavras.length) return [''];
    const linhas = [];
    let atual = palavras[0];
    for (let i = 1; i < palavras.length; i++) {
      const teste = atual + ' ' + palavras[i];
      if (ctx.measureText(teste).width <= largura) atual = teste;
      else { linhas.push(atual); atual = palavras[i]; }
    }
    linhas.push(atual);
    return linhas;
  }

  function encolher(ctx, texto, largura, peso, tamMax, tamMin) {
    let tam = tamMax;
    do {
      ctx.font = fonte(peso, tam);
      if (ctx.measureText(texto).width <= largura) break;
      tam -= 2;
    } while (tam > tamMin);
    return tam;
  }

  function caixa(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  /* Linhas de informação do cabeçalho (data, cliente, atendente, endereço). */
  function linhasInfo(dados) {
    const info = [
      ['DATA', Fmt.data(dados.data)],
      ['CLIENTE', dados.cliente || '—'],
      ['ATENDENTE', dados.atendente || '—']
    ];
    if (dados.endereco) info.push(['ENDEREÇO', dados.endereco]);
    return info;
  }

  /* Mede tudo antes de desenhar, para saber a altura final da imagem. */
  function medir(ctx, dados) {
    ctx.font = fonte('normal', 26);
    const itens = dados.itens.map(it => {
      const linhas = quebrar(ctx, it.desc, COL.desc - 24);
      return { ...it, linhas, altura: Math.max(56, 22 + linhas.length * 34) };
    });

    const textoX = dados.temLogo ? M + 200 + 28 : M;
    const larguraTexto = L - M - textoX;
    const tamNome = encolher(ctx, (dados.empresa.nome || '').toUpperCase(), larguraTexto, 'bold', 52, 26);
    /* 8 (folga) + etiqueta 34 + 14 + nome + 18 + uma linha por informação */
    const cabecalho = 8 + 48 + tamNome + 18 + linhasInfo(dados).length * 46;
    const alturaCabecalho = Math.max(cabecalho, dados.temLogo ? 208 : 0);

    const tabela = 52 + itens.reduce((s, i) => s + i.altura, 0) + 56 /* subtotal */ + 56 /* taxa */;
    const temPix = !!(dados.empresa.pixChave || dados.empresa.pixTitular);
    /* 26 antes do total + faixa do total 76 + 30 + bloco de pagamento + 30 + barra final 52 */
    const rodape = 26 + 76 + 30 + Math.max(temPix ? 118 : 0, 96) + 30 + 52;

    return { itens, tamNome, textoX, larguraTexto, alturaCabecalho, altura: M + alturaCabecalho + 28 + tabela + rodape };
  }

  function render(canvas, dados, opcoes = {}) {
    const logo = opcoes.logo || null;
    dados = { ...dados, temLogo: !!logo };

    const ctx = canvas.getContext('2d');
    const medida = medir(ctx, dados);
    const escala = Math.min(2, globalThis.devicePixelRatio || 1) * 1.5;

    canvas.width = Math.round(L * escala);
    canvas.height = Math.round(medida.altura * escala);
    canvas.style.aspectRatio = `${L} / ${medida.altura}`;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.textBaseline = 'alphabetic';

    /* fundo */
    ctx.fillStyle = '#fbfbf7';
    ctx.fillRect(0, 0, L, medida.altura);

    /* ---------- cabeçalho ---------- */
    let textoX = medida.textoX;
    if (logo) {
      const lado = 200;
      ctx.save();
      caixa(ctx, M, M, lado, lado, 16);
      ctx.clip();
      const razao = Math.max(lado / logo.width, lado / logo.height);
      const lw = logo.width * razao, lh = logo.height * razao;
      ctx.drawImage(logo, M + (lado - lw) / 2, M + (lado - lh) / 2, lw, lh);
      ctx.restore();
    }

    let y = M + 8;
    const larguraTexto = medida.larguraTexto;

    /* etiqueta "PEDIDO" */
    ctx.fillStyle = VERDE;
    caixa(ctx, textoX, y, 150, 34, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = fonte('bold', 20);
    ctx.textAlign = 'center';
    ctx.fillText('PEDIDO', textoX + 75, y + 24);
    ctx.textAlign = 'left';
    y += 34 + 14;

    /* nome da barraca */
    const nome = (dados.empresa.nome || 'Minha Barraca').toUpperCase();
    const tam = medida.tamNome;
    ctx.fillStyle = VERDE;
    ctx.font = fonte('bold', tam);
    ctx.fillText(nome, textoX, y + tam);
    y += tam + 18;

    /* dados do pedido */
    const rotuloL = 170;
    for (const [rotulo, valor] of linhasInfo(dados)) {
      ctx.fillStyle = FRACO;
      ctx.font = fonte('bold', 21);
      ctx.fillText(rotulo, textoX, y + 26);

      ctx.strokeStyle = BORDA;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(textoX + rotuloL - 14, y + 4);
      ctx.lineTo(textoX + rotuloL - 14, y + 36);
      ctx.stroke();

      ctx.fillStyle = TEXTO;
      const tamValor = encolher(ctx, valor, larguraTexto - rotuloL, 'normal', 26, 16);
      ctx.font = fonte('normal', tamValor);
      ctx.fillText(valor, textoX + rotuloL, y + 26);
      y += 46;
    }

    /* ---------- tabela ---------- */
    let ty = M + medida.alturaCabecalho + 28;
    const xItem = M;
    const xDesc = xItem + COL.item;
    const xQuant = xDesc + COL.desc;
    const xValor = xQuant + COL.quant;
    const fimX = L - M;

    ctx.fillStyle = VERDE;
    ctx.fillRect(M, ty, fimX - M, 52);
    ctx.fillStyle = '#fff';
    ctx.font = fonte('bold', 21);
    ctx.textAlign = 'center';
    ctx.fillText('ITEM', xItem + COL.item / 2, ty + 33);
    ctx.fillText('QUANT.', xQuant + COL.quant / 2, ty + 33);
    ctx.fillText('VALOR TOTAL', xValor + COL.valor / 2, ty + 33);
    ctx.textAlign = 'left';
    ctx.fillText('DESCRIÇÃO', xDesc + 16, ty + 33);
    ty += 52;

    let soma = 0;
    medida.itens.forEach((it, i) => {
      if (i % 2) {
        ctx.fillStyle = VERDE_CLARO;
        ctx.fillRect(M, ty, fimX - M, it.altura);
      }
      ctx.strokeStyle = BORDA;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M, ty + it.altura + .5);
      ctx.lineTo(fimX, ty + it.altura + .5);
      ctx.stroke();

      const meio = ty + it.altura / 2 + 9;
      ctx.fillStyle = FRACO;
      ctx.font = fonte('normal', 24);
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), xItem + COL.item / 2, meio);

      ctx.fillStyle = TEXTO;
      ctx.font = fonte('normal', 26);
      ctx.fillText(it.quantidade, xQuant + COL.quant / 2, meio);

      ctx.font = fonte('bold', 27);
      ctx.textAlign = 'right';
      ctx.fillText(Fmt.moeda(it.valor), xValor + COL.valor - 16, meio);

      ctx.textAlign = 'left';
      ctx.font = fonte('normal', 26);
      const topo = ty + it.altura / 2 - (it.linhas.length - 1) * 17 + 9;
      it.linhas.forEach((linha, k) => ctx.fillText(linha, xDesc + 16, topo + k * 34));

      soma += it.valor;
      ty += it.altura;
    });

    /* subtotal */
    ctx.fillStyle = FRACO;
    ctx.font = fonte('normal', 24);
    ctx.textAlign = 'right';
    ctx.fillText('Subtotal', xQuant + COL.quant - 16, ty + 36);
    ctx.fillStyle = TEXTO;
    ctx.font = fonte('bold', 26);
    ctx.fillText(Fmt.moeda(soma), xValor + COL.valor - 16, ty + 36);
    ty += 56;

    /* taxa de entrega */
    const taxa = Number(dados.taxa) || 0;
    ctx.fillStyle = FRACO;
    ctx.font = fonte('normal', 24);
    ctx.fillText('Taxa de entrega', xQuant + COL.quant - 16, ty + 36);
    if (taxa > 0) {
      ctx.fillStyle = TEXTO;
      ctx.font = fonte('bold', 26);
      ctx.fillText(Fmt.moeda(taxa), xValor + COL.valor - 16, ty + 36);
    } else {
      ctx.fillStyle = VERDE;
      ctx.font = fonte('bold', 26);
      ctx.fillText('GRÁTIS!', xValor + COL.valor - 16, ty + 36);
    }
    ty += 56;

    /* borda da tabela */
    ctx.strokeStyle = BORDA;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(M + .5, M + medida.alturaCabecalho + 28.5, fimX - M - 1, ty - (M + medida.alturaCabecalho + 28) - 1);

    /* ---------- total geral ---------- */
    ty += 26;
    const larguraTotal = 480;
    const xTotal = fimX - larguraTotal;
    ctx.fillStyle = VERDE;
    caixa(ctx, xTotal, ty, larguraTotal, 76, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = fonte('bold', 28);
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL GERAL', xTotal + 24, ty + 48);
    ctx.font = fonte('bold', 38);
    ctx.textAlign = 'right';
    ctx.fillText(Fmt.moeda(soma + taxa), fimX - 24, ty + 50);

    /* ---------- pagamento e agradecimento ---------- */
    const yBase = ty + 76 + 30;
    const emp = dados.empresa;
    if (emp.pixChave || emp.pixTitular) {
      ctx.strokeStyle = BORDA;
      ctx.lineWidth = 1.5;
      caixa(ctx, M, yBase, 470, 118, 10);
      ctx.stroke();
      ctx.fillStyle = FRACO;
      ctx.font = fonte('bold', 20);
      ctx.textAlign = 'left';
      ctx.fillText('DADOS PARA PAGAMENTO — PIX', M + 20, yBase + 32);
      ctx.fillStyle = TEXTO;
      const tamPix = encolher(ctx, emp.pixChave || '', 430, 'bold', 30, 16);
      ctx.font = fonte('bold', tamPix);
      ctx.fillText(emp.pixChave || '', M + 20, yBase + 72);
      ctx.fillStyle = FRACO;
      ctx.font = fonte('normal', 22);
      ctx.fillText(emp.pixTitular || '', M + 20, yBase + 102);
    }

    ctx.fillStyle = VERDE;
    ctx.font = fonte('bold italic', 32);
    ctx.textAlign = 'right';
    ctx.fillText('Obrigado pela preferência!', fimX, yBase + 46);
    if (emp.telefone) {
      ctx.fillStyle = FRACO;
      ctx.font = fonte('normal', 24);
      ctx.fillText(emp.telefone, fimX, yBase + 84);
    }

    /* ---------- barra final ---------- */
    const alturaBarra = 52;
    const yBarra = medida.altura - alturaBarra;
    ctx.fillStyle = VERDE;
    ctx.fillRect(0, yBarra, L, alturaBarra);
    ctx.fillStyle = '#dff0e4';
    ctx.font = fonte('bold', 21);
    ctx.textAlign = 'left';
    ctx.fillText(emp.telefone || emp.nome || '', M, yBarra + 33);
    ctx.textAlign = 'right';
    ctx.fillText(emp.slogan || '', fimX, yBarra + 33);
    ctx.textAlign = 'left';
  }

  function carregarLogo(dataUrl) {
    return new Promise(resolve => {
      if (!dataUrl) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  return { render, carregarLogo };
})();
