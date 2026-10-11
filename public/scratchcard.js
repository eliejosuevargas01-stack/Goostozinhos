/**
 * Goostozinhos Confeitaria — Raspadinha interativa (foil vivo)
 *
 * Três camadas, todas em canvas 2D:
 *  - máscara: o que ainda falta raspar (só ela decide quando o código é revelado);
 *  - textura: o foil dourado, com grão metálico e o convite "Raspe...";
 *  - brilho: um clarão que acompanha o dedo, o mouse ou a inclinação do celular.
 * O brilho é cosmético: se falhar, a raspagem continua igual. Sem movimento
 * (prefers-reduced-motion) o foil fica parado, como antes.
 */
class ScratchCard {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.container = this.canvas.parentElement;
    this.threshold = options.threshold || 45; // Revela automaticamente ao atingir 45%
    this.brushRadius = options.brushRadius || 24;
    this.onRevealed = options.onRevealed || (() => {});

    this.isRevealed = false;
    this.activePointer = null; // um único dedo/botão por vez; os demais são ignorados
    this.lastPoint = null;
    this.light = { x: 0.3, y: 0.35, tx: 0.3, ty: 0.35 }; // posição do brilho, de 0 a 1
    this.glint = null; // varredura de brilho que chama a atenção: { start, dur }
    this.glintTimer = 0;
    this.frame = 0;
    this.cleanup = [];

    this.mask = document.createElement('canvas');
    this.maskCtx = this.mask.getContext('2d', { willReadFrequently: true });
    this.texture = document.createElement('canvas');
    this.textureCtx = this.texture.getContext('2d');

    this.init();
  }

  init() {
    this.resizeCanvas();
    this.render();
    this.attachEvents();
    this.attachTilt();
    this.scheduleGlint(700);
    // O foil é pintado antes das fontes carregarem em conexões lentas: repinta a textura (a máscara não muda).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (this.isRevealed) return;
        this.paintTexture();
        this.requestRender();
      });
    }
  }

  reduceMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Ajusta as camadas ao tamanho real do cartão. Devolve false quando nada mudou, para não
  // apagar o que o cliente já raspou (a barra de endereço do celular dispara resize toda hora).
  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 320;
    const h = rect.height || 150;
    const dpr = window.devicePixelRatio || 1;
    if (this.displayWidth && Math.abs(w - this.displayWidth) < 0.5 && Math.abs(h - this.displayHeight) < 0.5 && dpr === this.dpr) return false;

    let previous = null;
    if (this.displayWidth) {
      previous = document.createElement('canvas');
      previous.width = this.mask.width;
      previous.height = this.mask.height;
      previous.getContext('2d').drawImage(this.mask, 0, 0);
    }

    this.displayWidth = w;
    this.displayHeight = h;
    this.dpr = dpr;
    for (const layer of [this.canvas, this.mask, this.texture]) {
      layer.width = Math.round(w * dpr);
      layer.height = Math.round(h * dpr);
    }
    for (const ctx of [this.ctx, this.maskCtx, this.textureCtx]) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.maskCtx.globalCompositeOperation = 'source-over';
    if (previous) {
      this.maskCtx.drawImage(previous, 0, 0, w, h); // preserva a área já raspada na nova escala
    } else {
      this.maskCtx.fillStyle = '#000';
      this.maskCtx.fillRect(0, 0, w, h);
    }
    this.paintTexture();
    return true;
  }

  paintTexture() {
    const ctx = this.textureCtx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);

    // Fundo dourado metálico em degradê
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#E8C78A');
    grad.addColorStop(0.3, '#D4A359');
    grad.addColorStop(0.7, '#F2DCB3');
    grad.addColorStop(1, '#BF8E42');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Grão metálico: pontos claros e escuros sempre iguais (semente fixa), para o foil não "tremer" ao repintar
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const specks = Math.round((w * h) / 90);
    for (let i = 0; i < specks; i++) {
      const light = rnd() > 0.5;
      ctx.fillStyle = light
        ? `rgba(255, 250, 235, ${(0.1 + rnd() * 0.16).toFixed(2)})`
        : `rgba(112, 66, 44, ${(0.05 + rnd() * 0.1).toFixed(2)})`;
      ctx.fillRect(rnd() * w, rnd() * h, 1.3, 1.3);
    }

    // Brilhos de confeitaria
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = 0; i < 35; i++) {
      ctx.beginPath();
      ctx.arc((i * 37) % w, (i * 23) % h, (i % 3) + 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // O convite é pintado por cima do brilho, a cada quadro, para o clarão nunca desbotar o texto.
  paintLabel(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#3D1B22';
    ctx.font = 'bold 15px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Raspe para revelar seu presente', w / 2, h / 2 - 8);

    ctx.font = '12px "DM Sans", sans-serif';
    ctx.fillStyle = 'rgba(61, 27, 34, 0.75)';
    ctx.fillText('Passe o dedo ou mouse', w / 2, h / 2 + 14);
    ctx.restore();
  }

  // Compõe: textura + brilho, recortados pela máscara (o que já foi raspado fica transparente).
  render() {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.texture, 0, 0, w, h);
    if (!this.reduceMotion()) {
      try { this.paintSheen(ctx, w, h); } catch (err) { /* o brilho é opcional */ }
    }
    this.paintLabel(ctx, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.mask, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  paintSheen(ctx, w, h) {
    const L = this.light;
    ctx.globalCompositeOperation = 'source-atop'; // só pinta onde o foil ainda existe
    const cx = L.x * w;
    const cy = L.y * h;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
    glow.addColorStop(0, 'rgba(255, 250, 232, 0.5)');
    glow.addColorStop(0.45, 'rgba(255, 240, 200, 0.18)');
    glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    if (this.glint) {
      const t = (performance.now() - this.glint.start) / this.glint.dur;
      if (t >= 1) {
        this.glint = null;
      } else {
        const x = (-0.25 + t * 1.5) * w;
        const band = ctx.createLinearGradient(x - w * 0.16, 0, x + w * 0.16, h * 0.5);
        band.addColorStop(0, 'rgba(255, 255, 255, 0)');
        band.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        band.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = band;
        ctx.fillRect(0, 0, w, h);
      }
    }
  }

  // Um quadro por vez; só roda enquanto há movimento (dedo, brilho a alcançar o alvo ou varredura).
  requestRender() {
    if (!this.frame) this.frame = requestAnimationFrame(() => this.tick());
  }

  tick() {
    this.frame = 0;
    if (this.isRevealed) return;
    const L = this.light;
    L.x += (L.tx - L.x) * 0.18;
    L.y += (L.ty - L.y) * 0.18;
    this.render();
    if (Math.abs(L.tx - L.x) > 0.002 || Math.abs(L.ty - L.y) > 0.002 || this.glint) this.requestRender();
  }

  setLight(point) {
    this.light.tx = Math.min(Math.max(point.x / this.displayWidth, 0), 1);
    this.light.ty = Math.min(Math.max(point.y / this.displayHeight, 0), 1);
    this.requestRender();
  }

  // Varredura de brilho a cada ~5 s até o cliente começar a raspar
  scheduleGlint(delay) {
    clearTimeout(this.glintTimer);
    if (this.isRevealed || this.reduceMotion()) return;
    this.glintTimer = setTimeout(() => {
      if (this.isRevealed || this.reduceMotion()) return;
      if (!document.hidden) {
        this.glint = { start: performance.now(), dur: 900 };
        this.requestRender();
      }
      this.scheduleGlint(5500);
    }, delay);
  }

  // Inclinação do celular. No iOS exige permissão do sistema: não pedimos, o foil só segue o dedo.
  attachTilt() {
    if (this.reduceMotion() || !('DeviceOrientationEvent' in window)) return;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') return;
    const onTilt = (e) => {
      if (this.isRevealed || this.activePointer !== null || e.gamma == null || e.beta == null) return;
      const clamp = (v) => Math.min(Math.max(v, -1), 1);
      this.light.tx = 0.5 + clamp(e.gamma / 45) * 0.4;
      this.light.ty = 0.5 + clamp((e.beta - 40) / 45) * 0.4;
      this.requestRender();
    };
    window.addEventListener('deviceorientation', onTilt);
    this.cleanup.push(() => window.removeEventListener('deviceorientation', onTilt));
  }

  attachEvents() {
    const canvas = this.canvas;
    const pos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e) => {
      if (this.isRevealed || this.activePointer !== null) return; // segundo dedo não rouba a raspagem
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.activePointer = e.pointerId;
      this.lastPoint = pos(e);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sem captura, os eventos seguem no canvas */ }
      clearTimeout(this.glintTimer); // já está raspando: a varredura de atenção sai de cena
      this.scratch(this.lastPoint.x, this.lastPoint.y);
      this.setLight(this.lastPoint);
    };

    const move = (e) => {
      if (this.isRevealed) return;
      if (this.activePointer === null) {
        if (e.pointerType === 'mouse') this.setLight(pos(e)); // mouse passando: o brilho acompanha
        return;
      }
      if (e.pointerId !== this.activePointer) return;
      if (e.cancelable) e.preventDefault();
      const current = pos(e);
      this.scratchLine(this.lastPoint.x, this.lastPoint.y, current.x, current.y);
      this.lastPoint = current;
      this.setLight(current);
    };

    // Fim do gesto: soltar, o navegador cancelar, perder a captura, trocar de janela ou de aba
    const end = (e) => {
      if (this.activePointer === null) return;
      if (e && e.pointerId !== undefined && e.pointerId !== this.activePointer) return;
      const id = this.activePointer;
      this.activePointer = null;
      this.lastPoint = null;
      try { canvas.releasePointerCapture(id); } catch (err) { /* já liberada */ }
      if (!this.isRevealed) this.checkScratchedPercentage();
    };
    const endOnHide = () => { if (document.hidden) end(); };

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move, { passive: false });
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', end);
    document.addEventListener('visibilitychange', endOnHide);
    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('lostpointercapture', end);
      window.removeEventListener('blur', end);
      document.removeEventListener('visibilitychange', endOnHide);
    });

    // O cartão cresce com o conteúdo (fonte que carrega, orientação): reajusta sem perder o que foi raspado
    if (typeof ResizeObserver === 'function' && this.container) {
      const observer = new ResizeObserver(() => {
        if (!this.isRevealed && this.resizeCanvas()) this.render();
      });
      observer.observe(this.container);
      this.cleanup.push(() => observer.disconnect());
    } else {
      const onResize = () => { if (!this.isRevealed && this.resizeCanvas()) this.render(); };
      window.addEventListener('resize', onResize);
      this.cleanup.push(() => window.removeEventListener('resize', onResize));
    }
  }

  scratch(x, y) {
    const ctx = this.maskCtx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, this.brushRadius, 0, Math.PI * 2);
    ctx.fill();
    this.requestRender();
  }

  scratchLine(x1, y1, x2, y2) {
    const ctx = this.maskCtx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = this.brushRadius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    this.requestRender();
  }

  checkScratchedPercentage() {
    if (this.isRevealed) return;

    const imgData = this.maskCtx.getImageData(0, 0, this.mask.width, this.mask.height);
    const data = imgData.data;

    // Amostragem por saltos para performance móvel
    const step = 16;
    let transparentPixels = 0;
    let totalSampled = 0;

    for (let i = 3; i < data.length; i += 4 * step) {
      totalSampled++;
      if (data[i] < 128) transparentPixels++;
    }

    const percent = (transparentPixels / totalSampled) * 100;
    if (percent >= this.threshold) this.reveal();
  }

  reveal() {
    if (this.isRevealed) return;
    this.isRevealed = true;
    this.activePointer = null;
    clearTimeout(this.glintTimer);
    cancelAnimationFrame(this.frame);
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];

    const reduce = this.reduceMotion();
    if (this.container) this.container.classList.add('is-revealed'); // lampejo curto, definido no CSS
    if (!reduce && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(14); } catch (err) { /* sem vibração neste aparelho */ }
    }

    // Efeito suave de desvanecimento
    const duration = reduce ? 0 : 500;
    this.canvas.style.transition = `opacity ${duration}ms ease-out`;
    this.canvas.style.opacity = '0';
    setTimeout(() => {
      this.canvas.style.display = 'none';
      if (typeof this.onRevealed === 'function') this.onRevealed();
    }, duration);
  }
}

window.ScratchCard = ScratchCard;
