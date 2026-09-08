# Pedidos da Barraca — GU HORTALIÇAS

Aplicação web para montar o pedido do cliente na feira, **no celular**, e gerar
uma **foto do pedido** no mesmo formato do bloco da barraca, pronta para enviar
pelo WhatsApp.

Não tem servidor e não tem banco de dados: é só HTML, CSS e JavaScript. Tudo
fica salvo no próprio aparelho (localStorage) e funciona sem internet depois da
primeira abertura.

## Como usar

Abra o `index.html` no navegador. Para usar nos celulares da barraca, publique a
pasta em qualquer hospedagem de site estático (GitHub Pages, Netlify) e, no
celular, use "Adicionar à tela de início" — o app abre em tela cheia e funciona
offline.

1. Toque em ⚙️ e entre com a senha do administrador (**padrão: `admin`**).
2. Cadastre os atendentes e **a chave PIX** — o nome, o telefone, o slogan e a
   logo da GU HORTALIÇAS já vêm preenchidos, mas a chave PIX fica em branco de
   propósito: dado de pagamento não vai dentro do código, cada aparelho cadastra
   a sua uma vez.
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

## Modo separação

Com o pedido montado, toque em **Separar** (no cartão de itens ou na aba do
topo). A lista vira uma checklist: toque no produto assim que ele entrar na
sacola — ele fica **verde e sobe para o topo**, na ordem em que foi separado.

A barra de cima mostra o quanto já foi ("3 de 11 separados") e a aba mostra o
mesmo em miniatura. O botão de baixo leva ao próximo produto que falta e, com
tudo separado, vai direto para a foto. "Desmarcar tudo" recomeça a conferência.

A separação fica salva junto com o pedido: dá para fechar o app no meio e
continuar depois. Ela é só para conferência interna — não aparece na foto que
o cliente recebe.

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
| `imagens/logo-gu.jpg` | Logo da barraca, usada no topo e na foto do pedido |

## Desempenho

O app precisa responder na hora, com o cliente esperando na frente da barraca.
As contas abaixo foram medidas com o processador 6× mais lento que o de
desenvolvimento, num pedido de 11 itens — perto de um celular modesto:

| | Antes | Agora |
| --- | --- | --- |
| Digitar uma letra | 2648 ms | 33 ms |
| Trocar de aba | 448 ms | 66–76 ms |
| Gerar a imagem | 5452 ms | ~450 ms, em segundo plano |
| Tamanho da foto | 3,8 MB | 630 KB |
| Primeira visita (4G lento) | 2376 ms | 1910 ms |

O que causava a lentidão: **cada tecla digitada redesenhava a foto inteira e
gerava o arquivo de imagem**. Um canvas de 13,3 megapixels e um PNG de 3,8 MB,
a cada letra.

O que mudou:

- A foto só é redesenhada quando está na tela, e é adiantada nos momentos em
  que ninguém está digitando — então a aba abre pronta.
- O arquivo para compartilhar é gerado só na aba da foto, em JPEG (3× menor que
  o PNG) e sem travar a tela.
- A foto tem no máximo 2000 px de largura e nenhum lado passa de 4000 px. Além
  de ser mais rápido, isso evita um limite do Safari no iPhone que devolvia a
  foto **em branco** em pedidos grandes.
- O pedido é gravado no aparelho com uma folga de 400 ms em vez de a cada
  tecla — e na hora, se o app for para segundo plano.
- A logo caiu de 185 KB para 99 KB, sem perda visível.

Qualquer caminho que pegue a imagem confere antes se o desenho está em dia, de
modo que a foto nunca sai desatualizada.

## Detalhes de celular

Testado em iPhone SE, iPhone 15, Android e tablet: sem rolagem lateral, nenhum
alvo de toque menor que 40 px e a barra do total sempre visível.

No iPhone o Safari só aceita o compartilhamento **dentro do toque**, sem espera
antes. Por isso a imagem do pedido é preparada assim que o pedido muda, e o
botão "Compartilhar" usa o arquivo já pronto.
