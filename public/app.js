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
let currentBrushSizePercent = 0.005; // Tamanho do pincel em porcentagem do canvas (0.5% = 5px em 1000px, valor inicial = 5 no slider)
let lastX = 0;
let lastY = 0;
let currentPath = [];
let paths = [];
let savedDrawings = []; // Desenhos salvos no servidor (coordenadas normalizadas 0-1)

// Função para desenhar apenas um traço (otimizado)
// Usa coordenadas normalizadas (0-1) e converte para pixels
function drawSingleStroke(path) {
    if (!path || path.length === 0) return;
    
    const canvasSize = canvas.width; // Canvas é sempre quadrado
    
    ctx.beginPath();
    // Converter coordenadas normalizadas para pixels
    const startX = path[0].x * canvasSize;
    const startY = path[0].y * canvasSize;
    ctx.moveTo(startX, startY);
    
    for (let i = 1; i < path.length; i++) {
        const x = path[i].x * canvasSize;
        const y = path[i].y * canvasSize;
        ctx.lineTo(x, y);
    }
    
    ctx.strokeStyle = path[0].color || '#000000';
    // O tamanho está normalizado como porcentagem (0-1), converter para pixels
    const normalizedSize = path[0].size || 0.005;
    ctx.lineWidth = normalizedSize * canvasSize;
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

// Configuração do canvas - quadrado, 100% da menor dimensão disponível
function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Usar a menor dimensão para manter quadrado (100% da menor dimensão)
    const newSize = Math.min(containerWidth, containerHeight);
    
    // Atualizar tamanho do canvas
    canvas.width = newSize;
    canvas.height = newSize;
    
    // Redesenhar todos os traços (coordenadas já são normalizadas)
    redrawCanvas();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Inicializar tamanho do pincel baseado no valor do slider
function initializeBrushSize() {
    const slider = document.getElementById('brushSize');
    const sliderValue = parseInt(slider.value);
    // Converter slider (1-50) para porcentagem do canvas (0.1% a 5%)
    // 1 = 0.1% = 1px em 1000px, 50 = 5% = 50px em 1000px
    currentBrushSizePercent = sliderValue / 1000;
    // Exibir o valor do slider diretamente (1 a 50)
    brushSizeValue.textContent = sliderValue;
}

initializeBrushSize();

// Atualizar tamanho do pincel (valor de 1-50 convertido para porcentagem relativa)
brushSize.addEventListener('input', (e) => {
    const sliderValue = parseInt(e.target.value);
    // Converter slider (1-50) para porcentagem do canvas (0.1% a 5%)
    // 1 = 0.1% = 1px em 1000px, 50 = 5% = 50px em 1000px
    currentBrushSizePercent = sliderValue / 1000;
    
    // Exibir o valor do slider diretamente (1 a 50)
    brushSizeValue.textContent = sliderValue;
});

// Atualizar cor
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
});

// Variável para manter o path atual durante o desenho
let currentDrawingPath = null;

// Função para desenhar no canvas (recebe coordenadas normalizadas 0-1)
function draw(normalizedX, normalizedY, color, normalizedSize, isStart = false) {
    const canvasSize = canvas.width;
    
    // Converter coordenadas normalizadas para pixels
    const x = normalizedX * canvasSize;
    const y = normalizedY * canvasSize;
    
    // Converter tamanho normalizado para pixels
    const pixelSize = normalizedSize * canvasSize;
    
    ctx.lineWidth = pixelSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    
    if (isStart) {
        // Iniciar novo path
        currentDrawingPath = { x: normalizedX, y: normalizedY, color, size: normalizedSize };
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

// Função para calcular coordenadas normalizadas (0-1) do mouse em relação ao canvas
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Calcular coordenadas em pixels
    const pixelX = (e.clientX - rect.left) * scaleX;
    const pixelY = (e.clientY - rect.top) * scaleY;
    
    // Normalizar para 0-1
    return {
        x: pixelX / canvas.width,
        y: pixelY / canvas.height
    };
}

// Função para calcular coordenadas normalizadas (0-1) do touch em relação ao canvas
function getCanvasTouchCoordinates(touch) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Calcular coordenadas em pixels
    const pixelX = (touch.clientX - rect.left) * scaleX;
    const pixelY = (touch.clientY - rect.top) * scaleY;
    
    // Normalizar para 0-1
    return {
        x: pixelX / canvas.width,
        y: pixelY / canvas.height
    };
}

// Eventos do mouse/touch no canvas
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const coords = getCanvasCoordinates(e);
    lastX = coords.x;
    lastY = coords.y;
    
    // Tamanho já está em porcentagem relativa (0-1)
    // Iniciar novo path (coordenadas e tamanho normalizados)
    currentPath = [{ x: lastX, y: lastY, color: currentColor, size: currentBrushSizePercent }];
    
    draw(lastX, lastY, currentColor, currentBrushSizePercent, true);
    
    // Enviar início do desenho (coordenadas e tamanho normalizados)
    socket.emit('draw-start', {
        x: lastX,
        y: lastY,
        color: currentColor,
        size: currentBrushSizePercent
    });
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;
    
    // Adicionar ponto ao path atual (tamanho em porcentagem)
    currentPath.push({ x, y, color: currentColor, size: currentBrushSizePercent });
    
    draw(x, y, currentColor, currentBrushSizePercent);
    
    // Enviar movimento do desenho (coordenadas normalizadas, tamanho em porcentagem)
    socket.emit('drawing', {
        x: x,
        y: y,
        color: currentColor,
        size: currentBrushSizePercent
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
    const coords = getCanvasTouchCoordinates(touch);
    lastX = coords.x;
    lastY = coords.y;
    isDrawing = true;
    
    // Tamanho já está em porcentagem relativa (0-1)
    // Iniciar novo path (coordenadas e tamanho normalizados)
    currentPath = [{ x: lastX, y: lastY, color: currentColor, size: currentBrushSizePercent }];
    
    draw(lastX, lastY, currentColor, currentBrushSizePercent, true);
    
    socket.emit('draw-start', {
        x: lastX,
        y: lastY,
        color: currentColor,
        size: currentBrushSizePercent
    });
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const touch = e.touches[0];
    const coords = getCanvasTouchCoordinates(touch);
    const x = coords.x;
    const y = coords.y;
    
    // Adicionar ponto ao path atual (tamanho em porcentagem)
    currentPath.push({ x, y, color: currentColor, size: currentBrushSizePercent });
    
    draw(x, y, currentColor, currentBrushSizePercent);
    
    socket.emit('drawing', {
        x: x,
        y: y,
        color: currentColor,
        size: currentBrushSizePercent
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

// Receber desenhos de outros usuários (coordenadas já normalizadas)
socket.on('draw-start', (data) => {
    draw(data.x, data.y, data.color, data.size, true);
});

socket.on('drawing', (data) => {
    draw(data.x, data.y, data.color, data.size);
});

socket.on('draw-end', () => {
    // Finalizar o caminho atual
});

// Função para normalizar desenhos antigos (migração de coordenadas absolutas para normalizadas)
function normalizeDrawings(drawings) {
    return drawings.map(drawing => {
        if (drawing.data && drawing.data.length > 0) {
            // Verificar se precisa normalizar (coordenadas > 1.1 indicam coordenadas absolutas)
            // Usamos 1.1 para evitar falsos positivos com coordenadas normalizadas próximas de 1
            const needsNormalization = drawing.data.some(path => 
                path.some(point => point.x > 1.1 || point.y > 1.1)
            );
            
            if (needsNormalization) {
                // Encontrar o tamanho original do canvas (assumir que coordenadas máximas indicam o tamanho)
                let maxCoord = 0;
                drawing.data.forEach(path => {
                    path.forEach(point => {
                        maxCoord = Math.max(maxCoord, point.x, point.y);
                    });
                });
                
                if (maxCoord > 0) {
                    // Normalizar coordenadas e tamanhos
                    drawing.data = drawing.data.map(path => 
                        path.map(point => ({
                            x: point.x / maxCoord,
                            y: point.y / maxCoord,
                            color: point.color,
                            // Normalizar tamanho: se size > 0.1, provavelmente está em pixels
                            size: (point.size && point.size > 0.1) ? point.size / maxCoord : (point.size || 0.005)
                        }))
                    );
                }
            }
        }
        return drawing;
    });
}

// Carregar desenhos salvos
async function loadSavedDrawings() {
    try {
        const response = await fetch('/api/drawings');
        const serverDrawings = await response.json();
        // Normalizar desenhos antigos se necessário
        savedDrawings = normalizeDrawings(serverDrawings);
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
    // Normalizar desenhos antigos se necessário
    savedDrawings = normalizeDrawings(drawings);
    redrawCanvas();
});

socket.on('drawing-saved', (newDrawing) => {
    // Normalizar o novo desenho se necessário (pode ser de um cliente antigo)
    const normalized = normalizeDrawings([newDrawing])[0];
    
    // Adicionar o novo desenho aos desenhos salvos
    savedDrawings.push(normalized);
    
    // Verificar se é um traço do próprio usuário
    let isMyStroke = false;
    if (paths.length > 0) {
        const lastPath = paths[paths.length - 1];
        const savedPath = normalized.data && normalized.data[0];
        
        // Verificar se é o mesmo traço comparando o primeiro ponto (coordenadas normalizadas)
        if (savedPath && savedPath.length > 0 && lastPath.length > 0 &&
            Math.abs(lastPath[0].x - savedPath[0].x) < 0.001 &&
            Math.abs(lastPath[0].y - savedPath[0].y) < 0.001) {
            // É o traço do próprio usuário - já está desenhado no canvas
            isMyStroke = true;
            // Remover de paths (já está salvo e desenhado)
            paths.pop();
        }
    }
    
    // Apenas desenhar se NÃO for do próprio usuário (traços de outros usuários)
    if (!isMyStroke && normalized.data && normalized.data.length > 0) {
        normalized.data.forEach(path => {
            drawSingleStroke(path);
        });
    }
});

// Carregar desenhos ao iniciar
loadSavedDrawings();

// Status de conexão - apenas círculo colorido
socket.on('connect', () => {
    status.className = 'status-indicator connected';
});

socket.on('disconnect', () => {
    status.className = 'status-indicator disconnected';
});

socket.on('connect_error', () => {
    status.className = 'status-indicator disconnected';
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

