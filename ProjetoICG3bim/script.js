document.addEventListener('DOMContentLoaded', () => {
    // --- Seleção dos Elementos do DOM ---
    // Obtém a referência para o elemento <canvas> e seu contexto de renderização 2D.
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');
    
    // Agrupa todos os elementos de input (sliders) em um objeto para fácil acesso.
    const controls = {
        translateX: document.getElementById('translateX'),
        translateY: document.getElementById('translateY'),
        scale: document.getElementById('scale'),
        rotation: document.getElementById('rotation'),
    };
    // Agrupa os elementos <span> que exibem os valores dos sliders.
    const values = {
        translateXValue: document.getElementById('translateXValue'),
        translateYValue: document.getElementById('translateYValue'),
        scaleValue: document.getElementById('scaleValue'),
        rotationValue: document.getElementById('rotationValue'),
    };
    
    // --- Variáveis de Estado ---
    // 'transformParams' armazena os valores atuais de translação, escala e rotação.
    let transformParams = { x: 0, y: 0, s: 1.0, r: 0 };
    // 'baseVertices' armazena as coordenadas originais (sem transformação) dos vértices.
    let baseVertices = [];
    // 'faces' armazena as definições de cada face, indicando quais vértices a compõem.
    let faces = [];
    // 'faceColors' armazena a cor de cada face correspondente.
    let faceColors = [];

    // --- Redimensionamento do Canvas ---
    // Função chamada quando a janela do navegador muda de tamanho.
    function resizeCanvas() {
        const board = document.querySelector('.drawing-board');
        // Ajusta a largura e altura do canvas para preencher seu container.
        canvas.width = board.clientWidth;
        canvas.height = board.clientHeight;
        // Redesenha o icosaedro para se ajustar ao novo tamanho.
        DesenhaIsocaedro();
    }

    // --- Lógica de Geometria --
    // Inicializa as coordenadas dos vértices e a definição das faces do icosaedro 2D.
    function inicializarIcosaedro() {
        // Define raios para os vértices internos e externos com base no tamanho do canvas.
        const R_interno = Math.min(canvas.width, canvas.height) / 2.5; 
        const R_externo = R_interno / 1.07;
       
        // Limpa os arrays para garantir que a geometria anterior seja removida.
        baseVertices.length = 0;
        faces.length = 0;
        faceColors.length = 0;

        // Adiciona o vértice central (índice 0).
        baseVertices.push({ x: 0, y: 0 });

        // Gera os vértices do triângulo maior.
        for (let i = 0; i < 3; i++) {
            const angle = i * (2 * Math.PI / 3) - (Math.PI / 2);
            baseVertices.push({ x: Math.cos(angle) * R_interno, y: Math.sin(angle) * R_interno });
        }
        // Gera os vértices do triângulo menor.
        for (let i = 0; i < 3; i++) {
            const angle = i * (2 * Math.PI / 3) + (Math.PI / 2);
            baseVertices.push({ x: Math.cos(angle) * (R_interno / 2), y: Math.sin(angle) * (R_interno / 2) });
        }
        // Gera os vértices do anel externo.
        for (let i = 0; i < 3; i++) {
            const angle = i * (2 * Math.PI / 3) + (Math.PI / 2);
            baseVertices.push({ x: Math.cos(angle) * R_externo, y: Math.sin(angle) * R_externo });
        }

        // Define as faces conectando os índices dos vértices.
        const allFaceDefinitions = [
            [1, 5, 6], [2, 6, 4], [4, 5, 3], [4, 5, 6],
            [1, 9, 6], [2, 4, 7], [3, 4, 7], [5, 3, 8], [5, 1, 8], [6, 9, 2]
        ];
        
        // Para cada definição de face, adiciona ao array 'faces' e gera uma cor aleatória.
        for (const faceDef of allFaceDefinitions) {
            faces.push(faceDef);
            faceColors.push(CorRGB_Random()); // Gera uma cor aleatória para cada face.
        }
        // Desenha a geometria recém-criada.
        DesenhaIsocaedro();
    }
    
    // --- Lógica de Pintura e Detecção de Clique ---
    // Algoritmo para verificar se um ponto 'p' está dentro de um triângulo (p0, p1, p2).
    function isPointInTriangle(p, p0, p1, p2) {
        const s = p0.y * p2.x - p0.x * p2.y + (p2.y - p0.y) * p.x + (p0.x - p2.x) * p.y;
        const t = p0.x * p1.y - p0.y * p1.x + (p0.y - p1.y) * p.x + (p1.x - p0.x) * p.y;
        if ((s < 0) != (t < 0) && s != 0 && t != 0) return false;
        const A = -p1.y * p2.x + p0.y * (p2.x - p1.x) + p0.x * (p1.y - p2.y) + p1.x * p2.y;
        return A < 0 ? (s <= 0 && s + t >= A) : (s >= 0 && s + t <= A);
    }

    // Função para alterar a cor de uma face ao ser clicada.
    function MudarCor(event) {
        const rect = canvas.getBoundingClientRect();
        // Calcula as coordenadas do clique relativas ao canvas.
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        const transformedVertices = getTransformedVertices();

        // Itera sobre as faces para encontrar em qual delas o clique ocorreu.
        for (let i = faces.length - 1; i >= 0; i--) {
            const faceVertexIndices = faces[i];
            if (!faceVertexIndices) continue;
            const p0 = transformedVertices[faceVertexIndices[0]];
            const p1 = transformedVertices[faceVertexIndices[1]];
            const p2 = transformedVertices[faceVertexIndices[2]];

            if (isPointInTriangle({ x: clickX, y: clickY }, p0, p1, p2)) {
                faceColors[i] = CorRGB_Random(); // Gera uma cor aleatória.
                DesenhaIsocaedro();
                return;
            }
        }
    }

    // --- Lógica de Desenho e Transformação ---
    // Calcula as posições dos vértices após aplicar as transformações atuais.
    function getTransformedVertices() {
        const matrix = new DOMMatrix();
        // A ordem das transformações é importante: primeiro move para o centro, depois translada, rotaciona e escala.
        matrix.translateSelf(canvas.width / 2, canvas.height / 2);
        matrix.translateSelf(transformParams.x, transformParams.y);
        matrix.rotateSelf(transformParams.r * 180 / Math.PI);
        matrix.scaleSelf(transformParams.s, transformParams.s);

        // Retorna um novo array com as coordenadas dos vértices transformados.
        return baseVertices.map(v => new DOMPoint(v.x, v.y).matrixTransform(matrix));
    }

    // Função principal que limpa e desenha o icosaedro no canvas.
    function DesenhaIsocaedro() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpa o canvas.
        if (baseVertices.length === 0) return; // Não faz nada se a geometria não foi inicializada.
        
        const transformedVertices = getTransformedVertices();

        // Itera sobre cada face para desenhá-la.
        faces.forEach((face, index) => {
            const points = face.map(vertexIndex => transformedVertices[vertexIndex]);
            if (points.length < 3) return; // Garante que há pontos suficientes.
                // Chama a função auxiliar para desenhar a face individualmente.
                DesenhaFace(index, points, CorRGB(0,0,0), 1, []);
        });
    }
    // Função auxiliar para definir a cor de preenchimento.
    function Cor(color){
        ctx.fillStyle = color;
        ctx.fill();
    }
    // Função auxiliar para definir o estilo da linha de contorno.
    function EstiloLinha(color, largura, style) {
        ctx.strokeStyle = color;
        ctx.lineWidth = largura;
        ctx.setLineDash(style || []); // Define o estilo do tracejado (ex: [5, 5]).
    }
    // Função auxiliar para criar uma string de cor RGB.
    function CorRGB(r, g, b) {
        return `rgb(${r}, ${g}, ${b})`;
    }
    function CorRGB_Random(r, g, b) {
        // Gera uma cor RGB aleatória com valores entre 0 e 255.
        r = Math.floor(Math.random() * 256);
        g = Math.floor(Math.random() * 256);
        b = Math.floor(Math.random() * 256);
        return `rgb(${r}, ${g}, ${b})`;
    }
    // Função que desenha um único triângulo (face).
    function DesenhaFace(index, points, corLinha, larguraLinha, estiloLinha) {
        ctx.beginPath(); // Inicia um novo caminho de desenho.
        ctx.moveTo(points[0].x, points[0].y); // Move para o primeiro vértice.
        ctx.lineTo(points[1].x, points[1].y); // Desenha linha para o segundo.
        ctx.lineTo(points[2].x, points[2].y); // Desenha linha para o terceiro.
        ctx.closePath(); // Fecha o caminho, conectando o último ao primeiro vértice.
        Cor(faceColors[index]); // Preenche o triângulo com a cor da face.
        EstiloLinha(corLinha, larguraLinha, estiloLinha); // Define o estilo da borda.
        ctx.stroke(); // Desenha a borda do triângulo.
    }

    // --- Função de Redefinição ---
    // Reseta as transformações para os valores padrão.
    function resetTransformations() {
        transformParams = { x: 0, y: 0, s: 1.0, r: 0 };
        // Reseta a posição dos sliders.
        controls.translateX.value = 0;
        controls.translateY.value = 0;
        controls.scale.value = 100;
        controls.rotation.value = 0;
        // Atualiza os valores de texto e redesenha.
        updateDisplayValues();
        DesenhaIsocaedro();
    }
    
    // --- Função para atualizar os valores exibidos ---
    // Sincroniza o texto informativo com os valores atuais das transformações.
    function updateDisplayValues() {
        values.translateXValue.textContent = transformParams.x.toFixed(0);
        values.translateYValue.textContent = transformParams.y.toFixed(0);
        values.scaleValue.textContent = transformParams.s.toFixed(2);
        values.rotationValue.textContent = (transformParams.r * 180 / Math.PI).toFixed(0);
    }
    
    // --- Funções de Import e Export ---
    function exportToJSON() {
        const data = {
            transformParams,
            baseVertices,
            faces,
            faceColors
        };
        // Converte o objeto de dados para uma string JSON e a codifica em Base64.
        const jsonString = JSON.stringify(data);
        const encodedData = btoa(jsonString);
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const dia = String(agora.getDate()).padStart(2, '0');
        const horas = String(agora.getHours()).padStart(2, '0');
        const minutos = String(agora.getMinutes()).padStart(2, '0');
        const segundos = String(agora.getSeconds()).padStart(2, '0');
        const dataFormatada = `${ano}-${mes}-${dia}_${horas}-${minutos}-${segundos}`;
        const blob = new Blob([encodedData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `icosaedro_${dataFormatada}.json`;
        document.body.appendChild(a);
        a.click(); // Simula o clique no link para iniciar o download.
        document.body.removeChild(a); // Remove o link após o uso.
        URL.revokeObjectURL(url);
    }

    // Abre uma janela para o usuário selecionar um arquivo JSON para importar.
    function importFromJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = event => {
                try {
                    // Decodifica o conteúdo do arquivo de Base64 e o converte de volta para um objeto.
                    const decodedData = atob(event.target.result);
                    const data = JSON.parse(decodedData);
                    
                    // Restaura o estado da aplicação com os dados carregados.
                    transformParams = data.transformParams;
                    baseVertices = data.baseVertices;
                    faces = data.faces;
                    faceColors = data.faceColors;
                    
                    // Atualiza os controles e a tela para refletir o estado importado.
                    controls.translateX.value = transformParams.x;
                    controls.translateY.value = transformParams.y;
                    controls.scale.value = transformParams.s * 100;
                    controls.rotation.value = transformParams.r * 180 / Math.PI;
                    
                    updateDisplayValues();
                    DesenhaIsocaedro();
                } catch (error) {
                    console.error("Erro ao importar o arquivo:", error);
                    alert("Falha ao carregar o arquivo. Certifique-se de que é um arquivo de exportação válido.");
                }
            };
            reader.readAsText(file); // Lê o arquivo como texto.
        };
        input.click(); // Abre a janela de seleção de arquivo.
    }


    // --- Configuração dos Event Listeners ---
    // Adiciona os "ouvintes" de eventos para interatividade.
    function setupEventListeners() {
        window.addEventListener('resize', resizeCanvas); // Para redimensionamento.
        
        // Adiciona um listener para cada slider de transformação.
        for (const key in controls) {
            controls[key].addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                // Atualiza o parâmetro de transformação correspondente.
                if (key === 'scale') transformParams.s = value / 100.0;
                else if (key === 'rotation') transformParams.r = value * Math.PI / 180.0;
                else if (key === 'translateX') transformParams.x = value;
                else if (key === 'translateY') transformParams.y = value;
                
                // Atualiza a interface e redesenha o icosaedro.
                updateDisplayValues();
                DesenhaIsocaedro();
            });
        }
        
        // Adiciona listeners para os botões de ação.
        document.getElementById('resetButton').addEventListener('click', resetTransformations);
        document.getElementById('newButton').addEventListener('click', () => {
            inicializarIcosaedro();
            resetTransformations();
        });
        // Listeners para os botões de importação e exportação.
        document.getElementById('exportButton').addEventListener('click', exportToJSON);
        document.getElementById('importButton').addEventListener('click', importFromJSON);
        document.getElementById('mainCanvas').addEventListener('click', MudarCor); // Para clicar e mudar a cor das faces.
    }

    // --- Inicialização ---
    setupEventListeners();// Configura os ouvintes de eventos.
    resizeCanvas(); // Ajusta o canvas ao tamanho inicial da janela.
    inicializarIcosaedro(); // Cria a geometria inicial do icosaedro.
});