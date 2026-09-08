/* ===================================================================
   Lê a mensagem que o cliente mandou (WhatsApp) e monta a lista de
   produtos com as quantidades. Tudo local, sem internet.
   Reconhece coisas como:
     "2 kg de tomate"   "12 limões"   "1 caixa de morango"
     "meia dúzia de ovos"   "banana x3"   "3x alface"   "500g de queijo"
   =================================================================== */
const Parser = (() => {

  /* Depois de letra acentuada o \b do JavaScript não funciona ("mç", "pé"). */
  const FIM = '(?![a-zà-úA-ZÀ-Ú0-9])';

  /* Abreviações que o pedido usa na coluna "QUANT." */
  const UNIDADES = [
    [new RegExp('^(quilos?|kilos?|kgs?|kg|k)' + FIM, 'i'), 'kg'],
    [new RegExp('^(gramas?|grs?|g)' + FIM, 'i'), 'g'],
    [new RegExp('^(litros?|lts?|lt|l)' + FIM, 'i'), 'L'],
    [new RegExp('^(d[uú]zias?|dzs?|dz)' + FIM, 'i'), 'dz'],
    [new RegExp('^(caixas?|cxs?|cx)' + FIM, 'i'), 'cx'],
    [new RegExp('^(bandejas?|bdjs?|bdj)' + FIM, 'i'), 'bdj'],
    [new RegExp('^(cartelas?|ctlas?|ctla)' + FIM, 'i'), 'ctla'],
    [new RegExp('^(ma[cç]os?|molhos?|m[cç])' + FIM, 'i'), 'mç'],
    [new RegExp('^(pacotes?|pcts?|pct)' + FIM, 'i'), 'pct'],
    [new RegExp('^(sacos?|sacas?|sc)' + FIM, 'i'), 'sc'],
    [new RegExp('^(p[eé]s?)' + FIM, 'i'), 'pé'],
    [new RegExp('^(unidades?|unids?|unds?|uns?|un)' + FIM, 'i'), 'un']
  ];

  const NUMEROS = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
    sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    quatorze: 14, catorze: 14, quinze: 15, vinte: 20, trinta: 30
  };

  /* Linhas que são só conversa, não produto. */
  const RUIDO = new RegExp('^(' + [
    'bom dia', 'boa tarde', 'boa noite', 'oi+', 'ola', 'ale', 'e ai', 'tudo bem\\??',
    'por favor', 'pfv', 'pf', 'obrigad[oa]', 'obg', 'valeu', 'vlw', 'ok', 'blz',
    'beleza', 'e isso', 'so isso', 'e so', 'e so isso', 'mais nada', 'nada mais',
    'fazer um pedido', 'um pedido', 'fazer o pedido', 'o pedido', 'pra hoje', 'para hoje',
    'pra amanha', 'para amanha', 'bom fim de semana', 'como vai', 'td bem\\??',
    'quanto (fica|deu|da|e)\\??', 'me ve', 'manda', 'pedido', 'lista', 'segue',
    'segue o pedido', 'anota( ai)?', 'bom trabalho', 'gratidao', 'ate mais', 'abraco'
  ].join('|') + ')[\\s!.,]*$', 'i');

  const VERBOS = new RegExp('^(?:me\\s+)?(?:quero|queria|gostaria(?:\\s+de)?|preciso(?:\\s+de)?|' +
    'vou\\s+querer|mandar?|mande|me\\s+v[eê]|v[eê]|p[oõ]e|coloca|bota|traz|separa|anota)' +
    FIM + '[\\s:,-]*', 'i');
  const ARTIGO = /^(?:de|do|da|dos|das|d')\s+/i;

  const semAcento = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* Remove marcador de lista, emoji e pontuação solta das pontas. */
  function limpar(texto) {
    return texto
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, ' ')
      .replace(/^[\s\-–—*•>»~+.]+/, '')
      .replace(/^\d+\s*[\)\-–]\s+/, '')       // "1) tomate"
      .replace(/^\d+\.\s+/, '')               // "1. tomate"  (decimal não tem espaço)
      .replace(/[\s.,;:!]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function unidadeDe(texto) {
    for (const [re, sigla] of UNIDADES) {
      const achou = texto.match(re);
      if (achou) return { sigla, resto: texto.slice(achou[0].length).trim() };
    }
    return null;
  }

  function arrumarDescricao(texto) {
    let d = texto.replace(ARTIGO, '').replace(/[\s.,;:!-]+$/, '').trim();
    if (!d) return '';
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  function formatar(qtd, unidade) {
    const n = Number.isInteger(qtd) ? String(qtd)
      : String(Number(qtd.toFixed(3))).replace('.', ',');
    return unidade ? `${n} ${unidade}` : n;
  }

  /* Interpreta um pedaço da mensagem. Devolve null se não for produto. */
  function lerItem(bruto) {
    let texto = limpar(bruto);
    if (!texto) return null;

    const semAcentoTexto = semAcento(texto).toLowerCase();
    if (RUIDO.test(semAcentoTexto)) return null;
    if (!/[a-zà-ú]{2}/i.test(texto)) return null;

    texto = texto.replace(VERBOS, '').trim();
    if (!texto) return null;

    let qtd = null, unidade = '', desc = texto;

    /* "3x alface" / "3 x alface" */
    let m = texto.match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(.+)$/i);
    if (m) {
      qtd = parseFloat(m[1].replace(',', '.'));
      desc = m[2];
    }

    /* "1/2 kg de queijo" */
    if (qtd === null && (m = texto.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/))) {
      qtd = parseFloat(m[1]) / parseFloat(m[2]);
      const u = unidadeDe(m[3]);
      if (u) { unidade = u.sigla; desc = u.resto; } else { desc = m[3]; }
    }

    /* "2 kg de tomate" / "500g queijo" / "12 limões" */
    if (qtd === null && (m = texto.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/))) {
      qtd = parseFloat(m[1].replace(',', '.'));
      const u = unidadeDe(m[2]);
      if (u) { unidade = u.sigla; desc = u.resto; } else { desc = m[2]; }
    }

    /* "meia dúzia de ovos" / "meio quilo de tomate" */
    if (qtd === null && (m = texto.match(/^(meia|meio|metade\s+de\s+um[a]?)\s+(.*)$/i))) {
      const u = unidadeDe(m[2]);
      if (u && u.sigla === 'dz') { qtd = 6; unidade = 'un'; desc = u.resto; }
      else if (u) { qtd = 0.5; unidade = u.sigla; desc = u.resto; }
      else { qtd = 0.5; unidade = 'kg'; desc = m[2]; }   // "meio de tomate" = meio quilo
    }

    /* "duas caixas de morango" */
    if (qtd === null && (m = texto.match(/^([a-zà-ú]+)\s+(.*)$/i))) {
      const numero = NUMEROS[semAcento(m[1]).toLowerCase()];
      if (numero) {
        qtd = numero;
        const u = unidadeDe(m[2]);
        if (u) { unidade = u.sigla; desc = u.resto; } else { desc = m[2]; }
      }
    }

    /* "tomate x2" / "tomate 2kg" no fim da frase */
    if (qtd === null && (m = texto.match(/^(.+?)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i))) {
      desc = m[1];
      qtd = parseFloat(m[2].replace(',', '.'));
    }
    if (qtd === null && (m = texto.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zà-ú]{1,8})?$/i))) {
      const u = m[3] ? unidadeDe(m[3]) : null;
      if (u && !u.resto) {
        desc = m[1];
        qtd = parseFloat(m[2].replace(',', '.'));
        unidade = u.sigla;
      }
    }

    if (qtd === null) { qtd = 1; }
    if (!unidade) unidade = 'un';
    if (qtd <= 0) qtd = 1;

    desc = arrumarDescricao(desc);
    if (!desc || !/[a-zà-ú]{2}/i.test(desc)) return null;

    return { desc, quantidade: formatar(qtd, unidade) };
  }

  /* Linhas que na verdade são o nome do cliente ou o endereço. */
  const CLIENTE = /^(?:nome|cliente)\s*[:\-]\s*(.+)$/i;
  const ENDERECO = /^(?:endere[cç]o|end|entrega|entregar\s+n[ao])\s*[:\-]?\s*(.+)$/i;
  const RUA = /^(?:rua|r\.|av\.?|avenida|travessa|tv\.|alameda|estrada|rodovia)\b.*/i;

  /* "Alface e rúcula" costuma ser dois produtos; "Pão de queijo e leite" também.
     Só divide por " e " quando o trecho é curto e não tem número no meio. */
  function separarProdutos(trecho) {
    const partes = trecho.split(/,+/);
    const saida = [];
    for (const parte of partes) {
      const curto = parte.trim().split(/\s+/).length <= 5 && !/\d/.test(parte);
      if (curto) saida.push(...parte.split(/\s+e\s+/i));
      else saida.push(...parte.split(/\s+e\s+(?=\d|um |uma |dois |duas |tr[eê]s |meia |meio )/i));
    }
    return saida;
  }

  function ler(mensagem) {
    const itens = [];
    let cliente = '', endereco = '';

    for (const linha of String(mensagem || '').split(/[\n;]+/)) {
      const bruta = linha.trim();
      if (!bruta) continue;

      let m;
      if ((m = bruta.match(CLIENTE))) { cliente = m[1].trim(); continue; }
      if ((m = bruta.match(ENDERECO))) { endereco = m[1].trim(); continue; }
      if (RUA.test(limpar(bruta))) { endereco = limpar(bruta); continue; }

      /* "Bom dia! Vou querer:" — cada frase é avaliada separadamente e
         uma linha terminada em ":" é só a abertura do pedido. */
      for (const frase of bruta.split(/[!?]+/)) {
        if (/:\s*$/.test(frase.trim())) continue;
        const limpa = limpar(frase);
        if (!limpa) continue;
        for (const pedaco of separarProdutos(limpa)) {
          const item = lerItem(pedaco);
          if (item) itens.push(item);
        }
      }
    }

    return { itens, cliente, endereco };
  }

  return { ler, lerItem };
})();

if (typeof module !== 'undefined') module.exports = Parser;
