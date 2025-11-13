// Configuração do Socket.io
const socket = io();

// Elementos do DOM
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const status = document.getElementById('status');

// Estado do desenho
let isDrawing = false;
let currentColor = '#000000';
let currentBrushSize = 5;
let lastX = 0;
let lastY = 0;
let currentPath = [];
let paths = [];
let savedDrawings = []; // Desenhos salvos no servidor

// Função para desenhar apenas um traço (otimizado)
function drawSingleStroke(path) {
    if (!path || path.length === 0) return;
    
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.strokeStyle = path[0].color || '#000000';
    ctx.lineWidth = path[0].size || 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
}

// Função para redesenhar todos os traços
function redrawCanvas() {
    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redesenhar desenhos salvos do servidor
    savedDrawings.forEach(drawing => {
        if (drawing.data && drawing.data.length > 0) {
            drawing.data.forEach(path => {
                drawSingleStroke(path);
            });
        }
    });
    
    // Redesenhar traços locais do usuário (ainda não salvos)
    paths.forEach(path => {
        drawSingleStroke(path);
    });
}

// Configuração do canvas
function resizeCanvas() {
    const container = canvas.parentElement;
    const maxWidth = container.clientWidth - 40;
    const maxHeight = container.clientHeight - 40;
    
    canvas.width = Math.min(1200, maxWidth);
    canvas.height = Math.min(800, maxHeight);
    
    // Redesenhar todos os traços
    redrawCanvas();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Atualizar tamanho do pincel
brushSize.addEventListener('input', (e) => {
    currentBrushSize = parseInt(e.target.value);
    brushSizeValue.textContent = currentBrushSize;
});

// Atualizar cor
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
});

// Variável para manter o path atual durante o desenho
let currentDrawingPath = null;

// Função para desenhar no canvas
function draw(x, y, color, size, isStart = false) {
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    
    if (isStart) {
        // Iniciar novo path
        currentDrawingPath = { x, y, color, size };
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else {
        // Continuar o path atual
        if (currentDrawingPath) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    }
}

// Eventos do mouse/touch no canvas
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    
    // Iniciar novo path
    currentPath = [{ x: lastX, y: lastY, color: currentColor, size: currentBrushSize }];
    
    draw(lastX, lastY, currentColor, currentBrushSize, true);
    
    // Enviar início do desenho
    socket.emit('draw-start', {
        x: lastX,
        y: lastY,
        color: currentColor,
        size: currentBrushSize
    });
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Adicionar ponto ao path atual
    currentPath.push({ x, y, color: currentColor, size: currentBrushSize });
    
    draw(x, y, currentColor, currentBrushSize);
    
    // Enviar movimento do desenho
    socket.emit('drawing', {
        x: x,
        y: y,
        color: currentColor,
        size: currentBrushSize
    });
    
    lastX = x;
    lastY = y;
});

canvas.addEventListener('mouseup', () => {
    if (isDrawing) {
        isDrawing = false;
        currentDrawingPath = null;
        
        // Salvar path completo
        if (currentPath.length > 0) {
            const stroke = [...currentPath];
            paths.push(stroke);
            currentPath = [];
            
            // Salvar automaticamente após cada traço
            saveCurrentDrawing();
        }
        
        socket.emit('draw-end');
    }
});

canvas.addEventListener('mouseleave', () => {
    if (isDrawing) {
        isDrawing = false;
        currentDrawingPath = null;
        
        // Salvar path completo
        if (currentPath.length > 0) {
            const stroke = [...currentPath];
            paths.push(stroke);
            currentPath = [];
            
            // Salvar automaticamente após cada traço
            saveCurrentDrawing();
        }
        
        socket.emit('draw-end');
    }
});

// Suporte para touch (mobile)
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    isDrawing = true;
    
    draw(lastX, lastY, currentColor, currentBrushSize, true);
    
    socket.emit('draw-start', {
        x: lastX,
        y: lastY,
        color: currentColor,
        size: currentBrushSize
    });
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    draw(x, y, currentColor, currentBrushSize);
    
    socket.emit('drawing', {
        x: x,
        y: y,
        color: currentColor,
        size: currentBrushSize
    });
    
    lastX = x;
    lastY = y;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isDrawing) {
        isDrawing = false;
        currentDrawingPath = null;
        
        // Salvar path completo
        if (currentPath.length > 0) {
            const stroke = [...currentPath];
            paths.push(stroke);
            currentPath = [];
            
            // Salvar automaticamente após cada traço
            saveCurrentDrawing();
        }
        
        socket.emit('draw-end');
    }
});

// Receber desenhos de outros usuários
socket.on('draw-start', (data) => {
    draw(data.x, data.y, data.color, data.size, true);
});

socket.on('drawing', (data) => {
    draw(data.x, data.y, data.color, data.size);
});

socket.on('draw-end', () => {
    // Finalizar o caminho atual
});

// Carregar desenhos salvos
async function loadSavedDrawings() {
    try {
        const response = await fetch('/api/drawings');
        const serverDrawings = await response.json();
        savedDrawings = serverDrawings;
        redrawCanvas();
    } catch (error) {
        console.error('Erro ao carregar desenhos:', error);
    }
}

// Salvar desenho atual automaticamente
function saveCurrentDrawing() {
    if (paths.length === 0) return;
    
    // Enviar apenas o último traço para o servidor
    const lastStroke = paths[paths.length - 1];
    if (lastStroke && lastStroke.length > 0) {
        socket.emit('save-drawing', [lastStroke]);
    }
}

socket.on('drawings-loaded', (drawings) => {
    savedDrawings = drawings;
    redrawCanvas();
});

socket.on('drawing-saved', (newDrawing) => {
    // Adicionar o novo desenho aos desenhos salvos
    savedDrawings.push(newDrawing);
    
    // Verificar se é um traço do próprio usuário
    let isMyStroke = false;
    if (paths.length > 0) {
        const lastPath = paths[paths.length - 1];
        const savedPath = newDrawing.data && newDrawing.data[0];
        
        // Verificar se é o mesmo traço comparando o primeiro ponto
        if (savedPath && savedPath.length > 0 && lastPath.length > 0 &&
            Math.abs(lastPath[0].x - savedPath[0].x) < 1 &&
            Math.abs(lastPath[0].y - savedPath[0].y) < 1) {
            // É o traço do próprio usuário - já está desenhado no canvas
            isMyStroke = true;
            // Remover de paths (já está salvo e desenhado)
            paths.pop();
        }
    }
    
    // Apenas desenhar se NÃO for do próprio usuário (traços de outros usuários)
    if (!isMyStroke && newDrawing.data && newDrawing.data.length > 0) {
        newDrawing.data.forEach(path => {
            drawSingleStroke(path);
        });
    }
});

// Carregar desenhos ao iniciar
loadSavedDrawings();

// Status de conexão
socket.on('connect', () => {
    status.textContent = 'Conectado';
    status.className = 'connected';
});

socket.on('disconnect', () => {
    status.textContent = 'Desconectado';
    status.className = 'disconnected';
});

socket.on('connect_error', () => {
    status.textContent = 'Erro de conexão';
    status.className = 'disconnected';
});

// WebRTC para comunicação peer-to-peer (opcional)
let peerConnection = null;
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// Inicializar WebRTC quando necessário
function initWebRTC() {
    peerConnection = new RTCPeerConnection(configuration);
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                target: socket.id // Em produção, você precisaria do ID do outro peer
            });
        }
    };
}

// Socket events para WebRTC
socket.on('offer', async (data) => {
    if (!peerConnection) initWebRTC();
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    socket.emit('answer', {
        answer: answer,
        target: data.sender
    });
});

socket.on('answer', async (data) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on('ice-candidate', async (data) => {
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// Carregar desenhos ao iniciar
loadSavedDrawings();

