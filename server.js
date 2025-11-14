const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DRAWINGS_FILE = path.join(__dirname, 'data', 'drawings.json');
const DRAWINGS_DIR = path.dirname(DRAWINGS_FILE);

// Garantir que o diretório data existe
fs.ensureDirSync(DRAWINGS_DIR);

// Carregar desenhos do arquivo
function loadDrawings() {
  try {
    if (fs.existsSync(DRAWINGS_FILE)) {
      const data = fs.readFileSync(DRAWINGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erro ao carregar desenhos:', error);
  }
  return [];
}

// Configuração de limites
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB máximo
const TARGET_FILE_SIZE = 3 * 1024 * 1024; // 3MB alvo (remove desenhos antigos quando passar disso)

// Salvar desenhos no arquivo (usando fila para evitar sobrecarga)
function saveDrawings(drawingsToSave) {
  // Adicionar à fila ao invés de salvar imediatamente
  saveQueue.push(drawingsToSave);
  processSaveQueue();
}

// Verificar e limitar tamanho do arquivo
function limitFileSize(drawings) {
  // Primeiro, remover desenhos expirados
  let validDrawings = removeExpiredDrawingsFromArray(drawings);
  
  // Verificar tamanho do JSON em memória
  const jsonString = JSON.stringify(validDrawings);
  const currentSize = Buffer.byteLength(jsonString, 'utf8');
  
  // Se estiver acima do limite, remover desenhos mais antigos
  if (currentSize > MAX_FILE_SIZE) {
    console.log(`Arquivo muito grande (${(currentSize / 1024 / 1024).toFixed(2)}MB), removendo desenhos antigos...`);
    
    // Ordenar por timestamp (mais antigos primeiro)
    validDrawings.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remover desenhos mais antigos até ficar abaixo do tamanho alvo
    while (validDrawings.length > 0) {
      const testJson = JSON.stringify(validDrawings);
      const testSize = Buffer.byteLength(testJson, 'utf8');
      
      if (testSize <= TARGET_FILE_SIZE) {
        break;
      }
      
      // Remover o desenho mais antigo
      validDrawings.shift();
    }
    
    console.log(`Arquivo reduzido para ${(Buffer.byteLength(JSON.stringify(validDrawings), 'utf8') / 1024 / 1024).toFixed(2)}MB`);
  }
  
  return validDrawings;
}

// Remover desenhos expirados de um array (versão para uso interno)
function removeExpiredDrawingsFromArray(drawingsArray) {
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000; // 1 semana em milissegundos
  
  return drawingsArray.filter(drawing => {
    const age = now - drawing.timestamp;
    return age < oneWeek;
  });
}

// Carregar desenhos do arquivo
let drawings = loadDrawings();

// Remover desenhos expirados (mais de 1 semana) e limitar tamanho
function removeExpiredDrawings() {
  const originalLength = drawings.length;
  let validDrawings = removeExpiredDrawingsFromArray(drawings);
  
  // Também limitar por tamanho
  validDrawings = limitFileSize(validDrawings);
  
  if (validDrawings.length !== originalLength) {
    drawings = validDrawings;
    saveDrawings(validDrawings);
    console.log(`Limpeza: ${originalLength - validDrawings.length} desenhos removidos`);
  }
  
  return validDrawings;
}

// Aplicar limpeza inicial
drawings = removeExpiredDrawings();

// Fila de salvamento para evitar sobrecarga
let saveQueue = [];
let isSaving = false;

function processSaveQueue() {
  if (isSaving || saveQueue.length === 0) return;
  
  isSaving = true;
  let drawingsToSave = [...drawings];
  
  // Limitar tamanho do arquivo antes de salvar
  drawingsToSave = limitFileSize(drawingsToSave);
  drawings = drawingsToSave; // Atualizar array principal
  
  // Salvar de forma assíncrona
  fs.writeFile(DRAWINGS_FILE, JSON.stringify(drawingsToSave, null, 2), (error) => {
    if (error) {
      console.error('Erro ao salvar desenhos:', error);
    }
    isSaving = false;
    
    // Processar próximo item da fila se houver
    if (saveQueue.length > 0) {
      setTimeout(processSaveQueue, 10);
    }
  });
}

// Executar limpeza a cada hora
setInterval(() => {
  drawings = removeExpiredDrawings();
  io.emit('drawings-updated', drawings);
}, 60 * 60 * 1000); // 1 hora

// Rota para obter todos os desenhos
app.get('/api/drawings', (req, res) => {
  drawings = removeExpiredDrawings();
  res.json(drawings);
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);
  
  // Função para contar usuários online e notificar todos
  const updateOnlineCount = () => {
    const count = io.sockets.sockets.size;
    io.emit('online-count', count);
  };
  
  // Enviar contagem inicial para o novo cliente
  updateOnlineCount();
  
  // Enviar desenhos existentes para o novo cliente
  socket.emit('drawings-loaded', drawings);
  
  // Quando um cliente começa a desenhar
  socket.on('draw-start', (data) => {
    // Propagar o evento com o strokeId incluído
    socket.broadcast.emit('draw-start', data);
  });
  
  // Quando um cliente está desenhando
  socket.on('drawing', (data) => {
    // Propagar o evento com o strokeId incluído
    socket.broadcast.emit('drawing', data);
  });
  
  // Quando um cliente termina de desenhar
  socket.on('draw-end', (data) => {
    // Propagar o evento com o strokeId incluído (se fornecido)
    socket.broadcast.emit('draw-end', data || {});
  });
  
  // Quando um cliente salva um desenho completo
  socket.on('save-drawing', (drawingData) => {
    const newDrawing = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      data: drawingData,
      timestamp: Date.now()
    };
    
    drawings.push(newDrawing);
    
    // Notificar todos os clientes de forma assíncrona (não bloqueia)
    process.nextTick(() => {
      io.emit('drawing-saved', newDrawing);
    });
    
    // Salvar em background usando fila (com limite de tamanho)
    saveDrawings(drawings);
  });
  
  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });
  
  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });
  
  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
    // Atualizar contagem quando usuário desconecta
    updateOnlineCount();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT}`);
});

