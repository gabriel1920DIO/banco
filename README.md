# Pedidos da Barraca

Aplicação web simples para montar o pedido do cliente na feira e gerar uma
**foto do pedido** pronta para enviar pelo WhatsApp.

Não tem servidor e não tem banco de dados: é só HTML, CSS e JavaScript. Tudo
fica salvo no próprio navegador do aparelho (localStorage).

## Como usar

Abra o arquivo `index.html` no navegador (funciona no celular também).

Para usar em vários aparelhos da barraca, publique a pasta em qualquer
hospedagem de site estático (GitHub Pages, Netlify, etc.). Cada aparelho guarda
a própria configuração.

1. Toque em ⚙️ e entre com a senha do administrador (**padrão: `admin`**).
2. Cadastre os atendentes e os dados da barraca (nome, telefone, PIX, logo).
3. **Troque a senha padrão** ainda no painel do administrador.
4. Na tela principal: escolha o atendente, digite o nome do cliente e vá
   adicionando os produtos.
5. Toque em **Compartilhar** (abre o WhatsApp com a imagem) ou em
   **Baixar imagem**.

## Como os produtos são lançados

Para cada produto você digita **produto, quantidade e valor total**. Não existe
campo de valor unitário: o atendente decide o preço fechado de cada item e
digita o total, com liberdade para negociar. O sistema só soma os totais e
acrescenta a taxa de entrega (que aparece como "GRÁTIS!" quando é zero).

## Atendente

O atendente é escolhido em uma lista e sai impresso na foto do pedido.
A lista de atendentes só pode ser criada, editada ou apagada por quem tem a
senha do administrador — o atendente comum apenas seleciona o próprio nome.

Observação: a senha protege a tela do administrador dentro do aparelho, mas os
dados ficam no navegador local. Não é um controle de acesso de servidor.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | Estrutura da tela e do painel do administrador |
| `css/styles.css` | Estilo (feito para celular primeiro) |
| `js/store.js` | Configuração, atendentes e senha no localStorage |
| `js/receipt.js` | Desenha o pedido no `<canvas>` — é a imagem gerada |
| `js/app.js` | Liga a tela ao pedido: itens, totais, admin, compartilhar |
