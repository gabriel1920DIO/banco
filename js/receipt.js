/* ===================================================================
   Desenha o pedido em um <canvas>, no mesmo formato do bloco de
   pedidos da barraca: logo redonda, faixa do fornecedor, tabela sobre
   papel pautado com marca d'água, taxa de entrega, total geral,
   dados do PIX e os selos de rodapé.
   =================================================================== */
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
  const L = 1000;                 // largura lógica da folha
  const M = 34;                   // margem
  const VERDE = '#14532d';
  const VERDE_MEIO = '#2f7d3c';
  const CREME = '#fbfaf3';
  const TEXTO = '#1b2420';
  const FRACO = '#6b7a71';
  const BORDA = '#c3cfc6';
  const PIX_COR = '#32bcad';
  const FONTE = 'Arial, Helvetica, sans-serif';
  const SERIF = 'Georgia, "Times New Roman", serif';

  /* Colunas iguais às do bloco: a de valor unitário fica sempre com "–",
     porque o preço é sempre lançado fechado, no valor total. */
  const COL = { item: 68, desc: 372, quant: 150, unit: 158, total: 186 };
  const LINHA_MIN = 5;            // a tabela nunca fica curta demais

  const fonte = (peso, tam, familia = FONTE) => `${peso} ${tam}px ${familia}`;

  function caixa(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

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

  function encolher(ctx, texto, largura, peso, tamMax, tamMin, familia) {
    let tam = tamMax;
    do {
      ctx.font = fonte(peso, tam, familia);
      if (ctx.measureText(texto).width <= largura) break;
      tam -= 2;
    } while (tam > tamMin);
    return tam;
  }

  function linhasInfo(dados) {
    const info = [['DATA', Fmt.data(dados.data)], ['CLIENTE', dados.cliente || '—']];
    if (dados.atendente) info.push(['ATENDENTE', dados.atendente]);
    if (dados.endereco) info.push(['ENDEREÇO', dados.endereco]);
    return info;
  }

  /* ---------- desenhos soltos ---------- */
  function folha(ctx, x, y, tam, cor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(0, tam / 2);
    ctx.bezierCurveTo(0, -tam / 2, tam, -tam / 2, tam, -tam / 2);
    ctx.bezierCurveTo(tam, tam / 2, 0, tam / 2, 0, tam / 2);
    ctx.fill();
    ctx.strokeStyle = cor;
    ctx.lineWidth = tam * .07;
    ctx.beginPath();
    ctx.moveTo(tam * .1, tam * .38);
    ctx.lineTo(tam * .85, -tam * .3);
    ctx.stroke();
    ctx.restore();
  }

  function coracao(ctx, x, y, tam, cor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(0, tam * .3);
    ctx.bezierCurveTo(-tam, -tam * .35, -tam * .35, -tam * .9, 0, -tam * .25);
    ctx.bezierCurveTo(tam * .35, -tam * .9, tam, -tam * .35, 0, tam * .3);
    ctx.fill();
    ctx.restore();
  }

  function estrela(ctx, x, y, raio, cor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = cor;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? raio * .45 : raio;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function selo(ctx, x, y, rotulo, desenho) {
    const raio = 30;
    ctx.strokeStyle = VERDE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.stroke();
    desenho(ctx, x, y);
    ctx.fillStyle = FRACO;
    ctx.font = fonte('bold', 15);
    ctx.textAlign = 'center';
    ctx.fillText(rotulo, x, y + raio + 24);
  }

  /* Losango do Pix, só para indicar a forma de pagamento. */
  function marcaPix(ctx, x, y, tam) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PIX_COR;
    caixa(ctx, -tam / 2, -tam / 2, tam, tam, tam * .22);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PIX_COR;
    ctx.font = fonte('bold', tam * .82);
    ctx.textAlign = 'left';
    ctx.fillText('pix', x + tam * .78, y + tam * .3);
  }

  /* ---------- medidas ---------- */
  function medir(ctx, dados) {
    ctx.font = fonte('normal', 25);
    const itens = dados.itens.map(it => {
      const linhas = quebrar(ctx, it.desc, COL.desc - 26);
      return { ...it, linhas, altura: Math.max(54, 20 + linhas.length * 32) };
    });

    const logoLado = dados.temLogo ? 250 : 0;
    const textoX = dados.temLogo ? M + logoLado + 26 : M;
    const larguraTexto = L - M - textoX;
    const tamNome = encolher(ctx, (dados.empresa.nome || '').toUpperCase(), larguraTexto, 'bold', 50, 24);
    const info = linhasInfo(dados);
    const cabecalhoTexto = 6 + 36 + 12 + tamNome + 16 + info.length * 46;
    const alturaCabecalho = Math.max(cabecalhoTexto, logoLado);

    const vazias = Math.max(0, LINHA_MIN - itens.length);
    const alturaTabela = 52 + itens.reduce((s, i) => s + i.altura, 0) + vazias * 54 + 58;

    const temPix = !!(dados.empresa.pixChave || dados.empresa.pixTitular);
    const alturaPagamento = temPix ? 176 : 96;

    const altura = M + alturaCabecalho + 24 + alturaTabela + 16 + 62 /* taxa */
                 + 18 + 84 /* total */ + 28 + alturaPagamento + 22 + 54 /* barra */;

    return { itens, vazias, tamNome, textoX, larguraTexto, logoLado, alturaCabecalho, temPix, altura };
  }

  /* ---------- desenho ---------- */
  function render(canvas, dados, opcoes = {}) {
    const logo = opcoes.logo || null;
    dados = { ...dados, temLogo: !!logo };

    const ctx = canvas.getContext('2d');
    const m = medir(ctx, dados);
    /* 2000 px de largura já sai nítido no WhatsApp, e nenhum lado passa de
       4000 px — acima disso o Safari do iPhone devolve a foto em branco. */
    const escala = Math.min(2, 4000 / m.altura, 4000 / L);

    canvas.width = Math.round(L * escala);
    canvas.height = Math.round(m.altura * escala);
    canvas.style.aspectRatio = `${L} / ${m.altura}`;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = CREME;
    ctx.fillRect(0, 0, L, m.altura);

    /* ======== cabeçalho ======== */
    if (logo) {
      const r = m.logoLado / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(M + r, M + r, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#fff';
      ctx.fill();
      const razao = Math.max(m.logoLado / logo.width, m.logoLado / logo.height);
      const lw = logo.width * razao, lh = logo.height * razao;
      ctx.drawImage(logo, M + r - lw / 2, M + r - lh / 2, lw, lh);
      ctx.restore();
    }

    let y = M + 6;
    ctx.fillStyle = VERDE;
    caixa(ctx, m.textoX, y, 196, 36, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = fonte('bold', 20);
    ctx.textAlign = 'center';
    ctx.fillText('FORNECEDOR', m.textoX + 98, y + 25);
    ctx.textAlign = 'left';
    y += 36 + 12;

    ctx.fillStyle = VERDE;
    ctx.font = fonte('bold', m.tamNome);
    ctx.fillText((dados.empresa.nome || 'Minha Barraca').toUpperCase(), m.textoX, y + m.tamNome);
    y += m.tamNome + 16;

    const rotuloL = 168;
    for (const [rotulo, valor] of linhasInfo(dados)) {
      ctx.fillStyle = FRACO;
      ctx.font = fonte('bold', 20);
      ctx.fillText(rotulo, m.textoX, y + 26);

      ctx.strokeStyle = BORDA;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.textoX + rotuloL - 16, y + 4);
      ctx.lineTo(m.textoX + rotuloL - 16, y + 36);
      ctx.stroke();

      ctx.fillStyle = TEXTO;
      const tam = encolher(ctx, valor, m.larguraTexto - rotuloL, 'normal', 25, 15);
      ctx.font = fonte('normal', tam);
      ctx.fillText(valor, m.textoX + rotuloL, y + 26);
      y += 46;
    }

    /* ======== tabela ======== */
    const topo = M + m.alturaCabecalho + 24;
    const xItem = M;
    const xDesc = xItem + COL.item;
    const xQuant = xDesc + COL.desc;
    const xUnit = xQuant + COL.quant;
    const xTotal = xUnit + COL.unit;
    const fimX = L - M;

    const alturaCorpo = m.itens.reduce((s, i) => s + i.altura, 0) + m.vazias * 54 + 58;

    /* papel pautado + marca d'água, atrás da tabela */
    ctx.save();
    ctx.beginPath();
    ctx.rect(M, topo + 52, fimX - M, alturaCorpo);
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(M, topo + 52, fimX - M, alturaCorpo);
    if (logo) {
      ctx.globalAlpha = .09;
      const lado = Math.min(620, alturaCorpo * 1.5);
      ctx.drawImage(logo, (L - lado) / 2, topo + 52 + (alturaCorpo - lado) / 2, lado, lado);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* cabeçalho da tabela */
    ctx.fillStyle = VERDE;
    ctx.fillRect(M, topo, fimX - M, 52);
    ctx.fillStyle = '#fff';
    ctx.font = fonte('bold', 19);
    ctx.textAlign = 'center';
    ctx.fillText('ITEM', xItem + COL.item / 2, topo + 33);
    ctx.fillText('QUANT.', xQuant + COL.quant / 2, topo + 33);
    ctx.fillText('VALOR UNIT.', xUnit + COL.unit / 2, topo + 33);
    ctx.fillText('VALOR TOTAL', xTotal + COL.total / 2, topo + 33);
    ctx.textAlign = 'left';
    ctx.fillText('DESCRIÇÃO', xDesc + 16, topo + 33);

    let ty = topo + 52;
    let soma = 0;

    const risco = yy => {
      ctx.strokeStyle = BORDA;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M, yy + .5);
      ctx.lineTo(fimX, yy + .5);
      ctx.stroke();
    };

    m.itens.forEach((it, i) => {
      const meio = ty + it.altura / 2 + 9;

      ctx.fillStyle = FRACO;
      ctx.font = fonte('normal', 23);
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), xItem + COL.item / 2, meio);

      ctx.fillStyle = TEXTO;
      ctx.font = fonte('normal', 25);
      ctx.fillText(it.quantidade, xQuant + COL.quant / 2, meio);

      ctx.fillStyle = '#9aa8a0';
      ctx.font = fonte('normal', 25);
      ctx.fillText('–', xUnit + COL.unit / 2, meio);

      ctx.fillStyle = TEXTO;
      ctx.font = fonte('bold', 26);
      ctx.textAlign = 'right';
      ctx.fillText(Fmt.moeda(it.valor), xTotal + COL.total - 16, meio);

      ctx.textAlign = 'left';
      ctx.font = fonte('normal', 25);
      const topoTexto = ty + it.altura / 2 - (it.linhas.length - 1) * 16 + 9;
      it.linhas.forEach((linha, k) => ctx.fillText(linha, xDesc + 16, topoTexto + k * 32));

      soma += it.valor;
      ty += it.altura;
      risco(ty);
    });

    for (let i = 0; i < m.vazias; i++) { ty += 54; risco(ty); }

    /* soma dos itens, na coluna do valor total */
    ctx.fillStyle = TEXTO;
    ctx.font = fonte('bold', 27);
    ctx.textAlign = 'right';
    ctx.fillText(Fmt.moeda(soma), xTotal + COL.total - 16, ty + 38);
    ty += 58;

    /* grade da tabela */
    ctx.strokeStyle = BORDA;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(M + .75, topo + .75, fimX - M - 1.5, ty - topo - 1.5);
    ctx.beginPath();
    for (const x of [xDesc, xQuant, xUnit, xTotal]) {
      ctx.moveTo(x + .5, topo + 52);
      ctx.lineTo(x + .5, ty);
    }
    ctx.stroke();

    /* ======== taxa de entrega ======== */
    ty += 16;
    const alturaTaxa = 62;
    const taxa = Number(dados.taxa) || 0;
    ctx.strokeStyle = BORDA;
    ctx.lineWidth = 1.5;
    caixa(ctx, M, ty, 420, alturaTaxa, 8);
    ctx.stroke();
    ctx.fillStyle = TEXTO;
    ctx.font = fonte('normal', 24);
    ctx.textAlign = 'center';
    ctx.fillText('TAXA DE ENTREGA', M + 210, ty + 39);

    const xGratis = M + 440;
    ctx.strokeStyle = taxa > 0 ? BORDA : VERDE_MEIO;
    caixa(ctx, xGratis, ty, 300, alturaTaxa, 8);
    ctx.stroke();
    ctx.fillStyle = taxa > 0 ? TEXTO : VERDE_MEIO;
    ctx.font = fonte('bold', 26);
    ctx.fillText(taxa > 0 ? Fmt.moeda(taxa) : 'GRÁTIS!', xGratis + 150, ty + 40);

    ctx.fillStyle = TEXTO;
    ctx.font = fonte('bold', 25);
    ctx.textAlign = 'right';
    ctx.fillText(Fmt.moeda(taxa), fimX, ty + 40);

    /* ======== total geral ======== */
    ty += alturaTaxa + 18;
    const larguraTotal = 520;
    const xBanner = fimX - larguraTotal;
    ctx.fillStyle = VERDE;
    caixa(ctx, xBanner, ty, larguraTotal, 84, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = fonte('bold', 30);
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL GERAL', xBanner + 26, ty + 53);
    ctx.font = fonte('bold', 40);
    ctx.textAlign = 'right';
    ctx.fillText(Fmt.moeda(soma + taxa), fimX - 26, ty + 55);

    /* ======== pagamento e agradecimento ======== */
    ty += 84 + 28;
    const emp = dados.empresa;

    if (m.temPix) {
      ctx.strokeStyle = BORDA;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(M, ty + .5);
      ctx.lineTo(M + 300, ty + .5);
      ctx.stroke();
      ctx.fillStyle = FRACO;
      ctx.font = fonte('bold', 19);
      ctx.textAlign = 'left';
      ctx.fillText('DADOS PARA PAGAMENTO', M, ty + 30);

      const yBox = ty + 44;
      ctx.strokeStyle = BORDA;
      caixa(ctx, M, yBox, 480, 128, 10);
      ctx.stroke();
      marcaPix(ctx, M + 40, yBox + 40, 30);
      ctx.fillStyle = FRACO;
      ctx.font = fonte('bold', 18);
      ctx.fillText('CHAVE PIX', M + 24, yBox + 76);
      ctx.fillStyle = TEXTO;
      const tamPix = encolher(ctx, emp.pixChave || '', 430, 'bold', 30, 15);
      ctx.font = fonte('bold', tamPix);
      ctx.fillText(emp.pixChave || '', M + 24, yBox + 104);
      if (emp.pixTitular) {
        ctx.fillStyle = FRACO;
        ctx.font = fonte('normal', 20);
        ctx.fillText(emp.pixTitular, M + 24, yBox + 122);
      }
    }

    ctx.fillStyle = VERDE;
    ctx.font = fonte('bold italic', 34, SERIF);
    ctx.textAlign = 'right';
    ctx.fillText('Obrigado pela preferência!', fimX, ty + 38);

    const ySelos = ty + 100;
    const xSelos = fimX - 290;
    selo(ctx, xSelos, ySelos, 'FRESCOR', (c, x, yy) => folha(c, x - 15, yy + 4, 30, VERDE_MEIO));
    selo(ctx, xSelos + 130, ySelos, 'QUALIDADE', (c, x, yy) => estrela(c, x, yy, 17, VERDE_MEIO));
    selo(ctx, xSelos + 260, ySelos, 'SAÚDE', (c, x, yy) => coracao(c, x, yy + 4, 20, VERDE_MEIO));

    /* ======== barra final ======== */
    const alturaBarra = 54;
    const yBarra = m.altura - alturaBarra;
    ctx.fillStyle = VERDE;
    ctx.fillRect(0, yBarra, L, alturaBarra);
    ctx.fillStyle = '#dff0e4';
    ctx.font = fonte('bold', 21);
    ctx.textAlign = 'left';
    ctx.fillText(emp.telefone || emp.nome || '', M, yBarra + 34);
    ctx.textAlign = 'right';
    ctx.fillText(emp.slogan || '', fimX, yBarra + 34);
    ctx.textAlign = 'left';
  }

  function carregarLogo(origem) {
    return new Promise(resolve => {
      if (!origem) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = origem;
    });
  }

  return { render, carregarLogo };
})();
