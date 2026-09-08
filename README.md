# Pedidos da Barraca

Aplicação web para montar o pedido do cliente na feira, **no celular**, e gerar
uma **foto do pedido** pronta para enviar pelo WhatsApp.

Não tem servidor e não tem banco de dados: é só HTML, CSS e JavaScript. Tudo
fica salvo no próprio aparelho (localStorage) e funciona sem internet depois da
primeira abertura.

## Como usar

Abra o `index.html` no navegador. Para usar nos celulares da barraca, publique a
pasta em qualquer hospedagem de site estático (GitHub Pages, Netlify) e, no
celular, use "Adicionar à tela de início" — o app abre em tela cheia e funciona
offline.

1. Toque em ⚙️ e entre com a senha do administrador (**padrão: `admin`**).
2. Cadastre os atendentes e os dados da barraca (nome, telefone, PIX, logo).
3. **Troque a senha padrão** ainda no painel do administrador.
4. Na tela principal: toque no seu nome, monte o pedido e toque em
   **Compartilhar**.

## Dois jeitos de montar o pedido

**Colando a mensagem do cliente.** Cole no campo "Colar a mensagem do cliente" o
que ele mandou no WhatsApp. O app separa os produtos e as quantidades, ignora as
saudações e ainda aproveita o endereço, se estiver na mensagem. Depois é só
tocar em cada preço — o Enter pula para o próximo. Ele entende, por exemplo:

```
Bom dia! Queria pra hoje:      ->  (ignorado)
2 kg de tomate italiano        ->  2 kg   Tomate italiano
1 caixa de morango             ->  1 cx   Morango
12 limões                      ->  12 un  Limões
meia dúzia de ovos             ->  6 un   Ovos
3 maços de couve               ->  3 mç   Couve
banana prata x3                ->  3 un   Banana prata
500g de queijo                 ->  500 g  Queijo
Endereço: Rua das Palmeiras    ->  vai para o campo de endereço
```

O que ele errar você corrige direto na lista: produto, quantidade e preço são
todos editáveis ali mesmo.

**Um produto por vez.** Digite o produto, ajuste a quantidade nos botões − / +,
escolha a unidade e digite o valor. Os produtos usados recentemente viram
atalhos de um toque.

## Sempre o valor total

Em qualquer um dos dois caminhos você digita o **valor total** do produto. Não
existe campo de valor unitário: o atendente fecha o preço e digita o total, com
liberdade para negociar. O app só soma e acrescenta a taxa de entrega (que sai
como "GRÁTIS!" quando é zero).

Enquanto faltar preço, o item fica marcado em laranja e o botão da barra de
baixo mostra quantos faltam.

## Atendente

O atendente é escolhido com um toque e sai impresso na foto do pedido. Cadastrar,
renomear ou remover atendentes exige a senha do administrador — o atendente
comum só seleciona o próprio nome.

Observação: a senha protege a tela do administrador dentro do aparelho, mas os
dados ficam no navegador local. Não é um controle de acesso de servidor.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | Estrutura da tela e da folha do administrador |
| `css/styles.css` | Estilo, pensado primeiro para o celular |
| `js/store.js` | Configuração, atendentes, senha e rascunho no localStorage |
| `js/parser.js` | Lê a mensagem do cliente e monta a lista de produtos |
| `js/receipt.js` | Desenha o pedido no `<canvas>` — é a imagem gerada |
| `js/app.js` | Liga a tela ao pedido: itens, totais, admin, compartilhar |
| `sw.js`, `manifest.webmanifest`, `icones/` | Instalação na tela de início e uso offline |
