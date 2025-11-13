# 🎨 Mural de Desenho Colaborativo

Um mural interativo onde múltiplos usuários podem desenhar colaborativamente em tempo real usando Socket.io e WebRTC. Os desenhos são salvos automaticamente e expiram após 1 semana.

## ✨ Funcionalidades

- 🖌️ **Desenho em tempo real** - Múltiplos usuários podem desenhar simultaneamente
- 🎨 **Personalização** - Escolha cores e tamanhos de pincel
- 💾 **Salvamento automático** - Desenhos são salvos no servidor
- ⏰ **Expiração automática** - Desenhos expiram após 1 semana
- 📱 **Responsivo** - Funciona em desktop e mobile
- 🔄 **Sincronização em tempo real** - Usa Socket.io para sincronização
- 🌐 **WebRTC** - Suporte para comunicação peer-to-peer

## 🚀 Como usar

### Instalação

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor:
```bash
npm start
```

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

3. Acesse no navegador:
```
http://localhost:3000
```

## 📁 Estrutura do Projeto

```
game-test/
├── server.js          # Servidor Node.js com Express e Socket.io
├── package.json       # Dependências do projeto
├── data/              # Diretório para armazenar desenhos (criado automaticamente)
│   └── drawings.json  # Arquivo JSON com os desenhos salvos
└── public/            # Arquivos estáticos do cliente
    ├── index.html     # Interface HTML
    ├── style.css      # Estilos CSS
    └── app.js         # Lógica do cliente (canvas, Socket.io, WebRTC)
```

## 🛠️ Tecnologias

- **Node.js** - Servidor backend
- **Express** - Framework web
- **Socket.io** - Comunicação em tempo real
- **WebRTC** - Comunicação peer-to-peer
- **HTML5 Canvas** - Área de desenho
- **JavaScript** - Lógica do cliente

## 📝 Como funciona

1. **Desenho**: Os usuários desenham no canvas HTML5
2. **Sincronização**: Cada traço é enviado via Socket.io para todos os outros usuários
3. **Armazenamento**: Os desenhos podem ser salvos no servidor
4. **Expiração**: Um job verifica e remove desenhos com mais de 1 semana a cada hora

## 🎯 Próximos passos

- Adicionar autenticação de usuários
- Melhorar a interface com mais ferramentas de desenho
- Adicionar suporte para múltiplos murais
- Implementar histórico de desenhos
- Adicionar exportação de imagens

## 📄 Licença

MIT

