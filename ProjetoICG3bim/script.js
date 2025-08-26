document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');

    // --- Referências aos Controles da UI ---
    const controls = {
        translateX: document.getElementById('translateX'),
        translateY: document.getElementById('translateY'),
        scale: document.getElementById('scale'),
        rotation: document.getElementById('rotation'),
        resetBtn: document.getElementById('reset-btn'), 
    };
    const values = {
        translateXValue: document.getElementById('translateXValue'),
        translateYValue: document.getElementById('translateYValue'),
        scaleValue: document.getElementById('scaleValue'),
        rotationValue: document.getElementById('rotationValue'),
    };
    const paintControls = {
        colorPicker: document.getElementById('color-picker'),
        colorDisplay: document.getElementById('color-display'),
        faceSelector: document.getElementById('face-selector'),
        paintBtn: document.getElementById('paint-btn'),
        clearPaintBtn: document.getElementById('clear-paint-btn'),
    };

    const estadoInicial = { tx: 0, ty: 0, s: 1.0, r: 0 };
    const corInicial = 'rgb(255,255,255)'; // Cor branca como padrão
    let transformParams = {...estadoInicial};
    let baseVertices = [];
    let faces = [];
    let faceColors = [];
    let pivo = { x: 0, y: 0 };

    function desenhaPoligono(ctx, pontos) {
        if (pontos.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(pontos[0].x, pontos[0].y);
        for (let i = 1; i < pontos.length; i++) {
            ctx.lineTo(pontos[i].x, pontos[i].y);
        }
        ctx.closePath();
    }

    function corLinha(ctx, cor){
        ctx.strokeStyle = cor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function preenchimento(ctx, cor) {
        ctx.fillStyle = cor;
        ctx.fill();
    }

    function translacao(pontos, tx = 0, ty = 0) {
        return pontos.map(p => ({ x: p.x + tx, y: p.y + ty }));
    }

    function rotacao(pontos, angulo, pivo) {
        const cosA = Math.cos(angulo);
        const sinA = Math.sin(angulo);
        return pontos.map(p => {
            const tempX = p.x - pivo.x;
            const tempY = p.y - pivo.y;
            const rotatedX = tempX * cosA - tempY * sinA;
            const rotatedY = tempX * sinA + tempY * cosA;
            return { x: rotatedX + pivo.x, y: rotatedY + pivo.y };
        });
    }

    function escala(pontos, fatorX, fatorY, pivo) {
            return pontos.map(p => {
            const tempX = p.x - pivo.x;
            const tempY = p.y - pivo.y;
            const scaledX = tempX * fatorX;
            const scaledY = tempY * fatorY;
            return { x: scaledX + pivo.x, y: scaledY + pivo.y };
        });
    }

    function resetarTransformacoes() {
        transformParams = { ...estadoInicial };
        controls.translateX.value = estadoInicial.tx;
        controls.translateY.value = estadoInicial.ty;
        controls.scale.value = estadoInicial.s * 100;
        controls.rotation.value = estadoInicial.r;
        updateDisplayValues();
        redesenharCena();
    }

    function limparPintura() {
        faceColors.fill(corInicial);
        redesenharCena();
    }

    // --- LÓGICA PRINCIPAL DE DESENHO ---
    function redesenharCena() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (baseVertices.length === 0) return;
        let pontos = baseVertices.map(p => ({ x: p.x, y: p.y }));
        pontos = escala(pontos, transformParams.s, transformParams.s, pivo);
        pontos = rotacao(pontos, transformParams.r, pivo);
        const finalTx = transformParams.tx + canvas.width / 2;
        const finalTy = transformParams.ty + canvas.height / 2;
        pontos = translacao(pontos, finalTx, finalTy);
        for (let i = 0; i < faces.length; i++) {
            const pontosDoPoligono = faces[i].map(indice => pontos[indice]);
            desenhaPoligono(ctx, pontosDoPoligono);
            preenchimento(ctx, faceColors[i]);
            corLinha(ctx, 'rgb(0,0,0)');
        }
    }
    
    // --- INICIALIZAÇÃO E HELPERS ---
    function inicializarIcosaedro() {
        const R_interno = Math.min(canvas.width, canvas.height) / 3.5;
        const R_externo = R_interno / 1.07;
        baseVertices = [];
        faces = [];
        faceColors = [];
        baseVertices.push({ x: 0, y: 0 });
        for (let i = 0; i < 3; i++) {
            const angle = i * (2 * Math.PI / 3) - (Math.PI / 2);
            baseVertices.push({ x: Math.cos(angle) * R_interno, y: Math.sin(angle) * R_interno });
        }
        for (let i = 0; i < 3; i++) {
            const angle = i * (2 * Math.PI / 3) + (Math.PI / 2);
            baseVertices.push({ x: Math.cos(angle) * (R_interno / 2), y: Math.sin(angle) * (R_interno / 2) });
        }
        for (let i = 0; i < 3; i++) {
            const angle = i * (2 * Math.PI / 3) + (Math.PI / 2);
            baseVertices.push({ x: Math.cos(angle) * R_externo, y: Math.sin(angle) * R_externo });
        }
        const allFaceDefinitions = [
            [1, 5, 6], [2, 6, 4], [4, 5, 3], [4, 5, 6],
            [2, 4, 7], [3, 4, 7], [5, 3, 8], [5, 1, 8], [1, 9, 6], [6, 9, 2]
        ];
        for (const faceDef of allFaceDefinitions) {
            faces.push(faceDef);
            faceColors.push(corInicial); // Usa a cor inicial padrão
        }
        pivo = {x: 0, y: 0};
        popularSeletorDeFaces();
        redesenharCena();
    }

    function popularSeletorDeFaces() {
        const selector = paintControls.faceSelector;
        selector.innerHTML = '';
        const todasOption = document.createElement('option');
        todasOption.value = "-1";
        todasOption.textContent = "Todas as Faces";
        selector.appendChild(todasOption);
        faces.forEach((_, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Face ${index + 1}`;
            selector.appendChild(option);
        });
    }

    function updateDisplayValues() {
        values.translateXValue.textContent = transformParams.tx.toFixed(0);
        values.translateYValue.textContent = transformParams.ty.toFixed(0);
        values.scaleValue.textContent = transformParams.s.toFixed(2);
        values.rotationValue.textContent = (transformParams.r * 180 / Math.PI).toFixed(0);
    }
    
    function resizeCanvas() {
        const board = document.querySelector('.drawing-board');
        canvas.width = board.clientWidth;
        canvas.height = board.clientHeight;
        inicializarIcosaedro();
    }

    function setupEventListeners() {
        window.addEventListener('resize', resizeCanvas);

        for (const key in controls) {
            if (key === 'resetBtn') continue; 
                controls[key].addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (key === 'scale') transformParams.s = value / 100.0;
                else if (key === 'rotation') transformParams.r = value * Math.PI / 180.0;
                else if (key === 'translateX') transformParams.tx = value;
                else if (key === 'translateY') transformParams.ty = value;
                updateDisplayValues();
                redesenharCena();
            });
        }
        
        controls.resetBtn.addEventListener('click', resetarTransformacoes);

        // --- Event Listeners para pintura ---
        paintControls.colorDisplay.style.backgroundColor = paintControls.colorPicker.value;
        paintControls.colorDisplay.addEventListener('click', () => paintControls.colorPicker.click());
        paintControls.colorPicker.addEventListener('input', (e) => {
            paintControls.colorDisplay.style.backgroundColor = e.target.value;
        });

        paintControls.paintBtn.addEventListener('click', () => {
            const selectedIndex = parseInt(paintControls.faceSelector.value, 10);
            const color = paintControls.colorPicker.value;
            if (selectedIndex === -1) {
                faceColors.fill(color);
            } else {
                faceColors[selectedIndex] = color;
            }
            redesenharCena();
        });

        // NOVO EVENT LISTENER PARA O BOTÃO DE LIMPAR
        paintControls.clearPaintBtn.addEventListener('click', limparPintura);
    }
    
    // --- PONTO DE ENTRADA ---
    setupEventListeners();
    resizeCanvas();
});
