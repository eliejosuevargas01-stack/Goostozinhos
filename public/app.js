/**
 * Goostozinhos Confeitaria — Frontend Application Logic
 * Gerenciamento de passos (1, 2, 3, 4), chamadas assíncronas ao n8n e revelação de cupom.
 */

// Configurações e endpoints (padrão n8n Dominus/Goostozinhos)
const CONFIG = {
  campaignId: 'campanha-goostozinhos-v1',
  webhookResgatarPresente: 'https://myn8n.dominuslabs.online/webhook/resgatar-presente',
  officialInstagram: 'goostozinhos',
  instagramProfileUrl: 'https://www.instagram.com/goostozinhos/',
  pedidoshopUrl: 'https://www.pedidos10.com.br/produtos/gostozinhos'
};

// Permite sobrescrever endpoints via window.GOOSTOZINHOS_CONFIG ou query params para testes locais
if (window.GOOSTOZINHOS_CONFIG) {
  Object.assign(CONFIG, window.GOOSTOZINHOS_CONFIG);
}

// Tempo máximo de espera pelo resgate: o fluxo completo no n8n (incluindo o envio do
// WhatsApp) leva em média 35 s, então esperamos até 45 s antes de desistir.
const REQUEST_TIMEOUT_MS = 45000;

// Progresso mostrado em cada passo (0 = boas-vindas); o encerramento também fecha em 100%.
const PROGRESS_BY_STEP = [0, 0, 33, 66, 100, 100];

const state = {
  step: 1,
  handleIg: '',
  instagramLinkClicked: false,
  reviewLinkClicked: false,
  reviewDeclared: false,
  phoneNumber: '',
  customerName: '',
  couponCode: '',
  isSubmitting: false
};

// --- Persistência de progresso (TTL 24h) ---
// salva stage, handle, link-click flags e telefone. NUNCA persiste cupom.
const STORAGE_KEY = 'goostozinhos-progress';
const TTL_MS = 86400000; // 24h fixas — não renovado a cada save quando ainda não expirou
let savedTs = null; // timestamp original do progresso (preservado até expirar)
const progress = {
  save() {
    if (savedTs !== null && (Date.now() < savedTs || Date.now() - savedTs >= TTL_MS)) {
      this.clear();
      return; // sessão vencida não ganha novo prazo com digitação ou refresh
    }
    const snapshot = {
      stage: state.step,
      handleIg: state.handleIg,
      instagramLinkClicked: state.instagramLinkClicked,
      reviewLinkClicked: state.reviewLinkClicked,
      reviewDeclared: state.reviewDeclared,
      phoneNumber: state.phoneNumber,
      customerName: state.customerName
    };
    if (savedTs === null) {
      const existing = this._readRaw();
      savedTs = existing ? existing.ts : Date.now();
    }
    const payload = { ts: savedTs, data: snapshot };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (e) { /* quota/storage disabled */ }
  },
  // Lê payload cru; devolve null em corrompido/expirado (limpando storage nesses casos)
  _readRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || typeof payload.ts !== 'number' || typeof payload.data !== 'object' || payload.data === null) { this.clear(); return null; }
      if (!Number.isFinite(payload.ts) || payload.ts > Date.now() || Date.now() - payload.ts >= TTL_MS) { this.clear(); return null; }
      return payload;
    } catch (e) { this.clear(); return null; } // corrompido → limpa
  },
  load() {
    const payload = this._readRaw();
    if (!payload) return null;
    savedTs = payload.ts; // preserva ts original para futuros saves
    return payload.data;
  },
  clear() {
    savedTs = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
};

// Elementos do DOM
const dom = {
  progressFill: document.getElementById('progress-fill'),
  progressBarContainer: document.getElementById('progress-bar-container'),
  progressLabel: document.getElementById('progress-label'),
  progressNumber: document.getElementById('progress-number'),
  progressSection: document.getElementById('progress-section'),
  welcome: document.getElementById('welcome'),
  feedbackBanner: document.getElementById('feedback-banner'),
  
  // Step 1
  step1: document.getElementById('step-1'),
  inputIg: document.getElementById('input-ig'),
  btnValidateIg: document.getElementById('btn-validate-ig'),
  btnOpenIg: document.getElementById('btn-open-ig'),
  
  // Step 2
  step2: document.getElementById('step-2'),
  btnOpenReview: document.getElementById('btn-open-review'),
  btnConfirmReview: document.getElementById('btn-confirm-review'),
  
  // Transição de Agradecimento
  gratitudeScene: document.getElementById('gratitude-scene'),
  gratitudeStage: document.getElementById('gratitude-stage'),
  gratitudeHeart: document.getElementById('gratitude-heart'),
  gratitudeTitle: document.getElementById('gratitude-title'),
  
  // Step 3
  step3: document.getElementById('step-3'),
  inputName: document.getElementById('input-name'),
  inputPhone: document.getElementById('input-phone'),
  btnClaimGift: document.getElementById('btn-claim-gift'),
  
  // Espera pelo n8n
  loadingNote: document.getElementById('loading-note'),

  // Step 4
  step4: document.getElementById('step-4'),
  step4Title: document.getElementById('step-4-title'),
  step4Intro: document.getElementById('step-4-intro'),
  revealedCouponCode: document.getElementById('revealed-coupon-code'),
  couponDiscount: document.getElementById('coupon-discount'),
  couponMinItem: document.getElementById('coupon-min-item'),
  couponMinOrder: document.getElementById('coupon-min-order'),
  couponValidity: document.getElementById('coupon-validity'),
  couponAvailability: document.getElementById('coupon-availability'),
  copyStatus: document.getElementById('copy-status'),
  btnFallbackReveal: document.getElementById('btn-fallback-reveal'),
  btnHowToUse: document.getElementById('btn-how-to-use'),
  btnOrderDirect: document.getElementById('btn-order-direct'),

  // Step 5
  step5: document.getElementById('step-5'),
  howtoLead: document.getElementById('howto-lead'),
  howtoCode: document.getElementById('howto-code'),
  howtoMin: document.getElementById('howto-min'),
  howtoValidity: document.getElementById('howto-validity'),
  btnBackToCode: document.getElementById('btn-back-to-code')
};

let scratchInstance = null;
let revealedByButton = false; // revelou pelo botão (teclado/leitor de tela): o foco segue para a próxima ação

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  setupPhoneMask();
  setupEventListeners();
  restoreSavedProgress();
  updateGating(); // também bloqueia Continuar quando não há progresso salvo
  const heroVideo = document.getElementById('ambient-video');
  const desktop = matchMedia('(min-width: 901px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'));
  heroVideo.addEventListener('error', () => heroVideo.classList.remove('is-playing'));
  heroVideo.addEventListener('pause', () => heroVideo.classList.remove('is-playing'));
  const syncHeroVideo = () => {
    if (document.hidden || !desktop.matches || reducedMotion.matches) heroVideo.pause();
    else heroVideo.play().catch(() => heroVideo.classList.remove('is-playing'));
  };
  document.addEventListener('visibilitychange', syncHeroVideo);
  desktop.addEventListener('change', syncHeroVideo);
  reducedMotion.addEventListener('change', syncHeroVideo);
  syncHeroVideo();
});

// Máscara de telefone brasileiro. Número colado ou preenchido pelo navegador pode vir com +55:
// o código do país só é retirado quando o número chega de uma vez (colar, autopreencher), nunca
// ao digitar, para não confundir com o DDD 55.
function formatPhone(raw, stripCountry) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (stripCountry && digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length > 6) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length > 2) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length > 0) return `(${digits}`;
  return '';
}

function setupPhoneMask() {
  dom.inputPhone.addEventListener('input', (e) => {
    e.target.value = formatPhone(e.target.value, e.inputType !== 'insertText');
  });
}

function normalizePhoneToE164(phoneRaw) {
  const digits = phoneRaw.replace(/\D/g, '');
  if (!/^[1-9][0-9]9?[0-9]{8}$/.test(digits)) return null;
  return `55${digits}`;
}

// --- Restaura progresso salvo (ou zera para estado coerente se expirado/corrompido) ---
function restoreSavedProgress() {
  const saved = progress.load();
  if (!saved) {
    state.step = 1;
    updateProgress(0);
    return;
  }
  // Validação de formato — ignora campos inválidos sem quebrar
  if (typeof saved.handleIg === 'string') state.handleIg = saved.handleIg;
  if (typeof saved.instagramLinkClicked === 'boolean') state.instagramLinkClicked = saved.instagramLinkClicked;
  if (typeof saved.reviewLinkClicked === 'boolean') state.reviewLinkClicked = saved.reviewLinkClicked;
  if (typeof saved.reviewDeclared === 'boolean') state.reviewDeclared = saved.reviewDeclared;
  if (typeof saved.phoneNumber === 'string') state.phoneNumber = saved.phoneNumber;
  if (typeof saved.customerName === 'string') state.customerName = saved.customerName;

  // Passos 4 e 5 nunca restauram: o cupom nunca é persistido; voltam ao estágio coerente anterior
  let stage = Number(saved.stage);
  if (stage >= 4) stage = 3;
  if (!Number.isInteger(stage) || stage < 1 || stage > 3) stage = 1;
  // Coerência: não permite pular etapa sem a flag real do passo anterior
  if (stage >= 3 && !(state.reviewLinkClicked && state.reviewDeclared)) stage = 2;
  if (stage >= 2 && !(state.instagramLinkClicked && state.handleIg)) stage = 1;
  state.step = stage;

  if (state.step > 1) {
    dom.progressSection.classList.remove('hidden');
    showScene(`step-${state.step}`);
  }
  if (state.step >= 3 && state.customerName) dom.inputName.value = state.customerName;
  if (state.step >= 3 && state.phoneNumber) dom.inputPhone.value = formatPhone(state.phoneNumber, true);
  if (state.handleIg) dom.inputIg.value = state.handleIg; // repõe o @ salvo para o gate do passo 1
  updateProgress(PROGRESS_BY_STEP[state.step] || 0);
  updateGating();
}

// --- Pendência até o clique real no link externo ---
// Os botões continuam clicáveis: antes do clique mostram o que falta (em vez de ficarem mudos) e o link ganha o ✓ depois.
const LINK_COPY = {
  ig: { idle: 'Abrir perfil no Instagram', done: 'Perfil aberto',
    aria: 'Abrir perfil @goostozinhos no Instagram (abre em nova aba)', ariaDone: 'Perfil aberto. Toque para abrir de novo (abre em nova aba)' },
  review: { idle: 'Abrir Pedidos10', done: 'Pedidos10 aberto',
    aria: 'Abrir Pedidos10 Goostozinhos (abre em nova aba)', ariaDone: 'Pedidos10 aberto. Toque para abrir de novo (abre em nova aba)' }
};

function renderPending(btn, pending) {
  if (btn) btn.setAttribute('aria-disabled', String(pending));
}

function renderLinkDone(link, done, copy) {
  if (!link) return;
  link.classList.toggle('is-done', done);
  link.firstChild.textContent = (done ? copy.done : copy.idle) + ' ';
  link.querySelector('span').textContent = done ? '✓' : '↗';
  link.setAttribute('aria-label', done ? copy.ariaDone : copy.aria);
}

// Aponta o link que falta abrir: anel rápido + foco
function nudgeLink(link) {
  if (!link) return;
  link.classList.remove('nudge');
  void link.offsetWidth;
  link.classList.add('nudge');
  link.addEventListener('animationend', () => link.classList.remove('nudge'), { once: true });
  link.focus({ preventScroll: true });
}

const IG_HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

// Gate do passo 1: Continuar só funciona com o link do Instagram aberto E @ válido no input.
function igInputValid() {
  return IG_HANDLE_RE.test(dom.inputIg.value.trim().replace(/^@+/, ''));
}

function updateGating() {
  const igReady = state.instagramLinkClicked && igInputValid();
  renderPending(dom.btnValidateIg, !igReady);
  if (dom.btnValidateIg) dom.btnValidateIg.disabled = !igReady;
  renderPending(dom.btnConfirmReview, !state.reviewLinkClicked);
  renderLinkDone(dom.btnOpenIg, state.instagramLinkClicked, LINK_COPY.ig);
  renderLinkDone(dom.btnOpenReview, state.reviewLinkClicked, LINK_COPY.review);
}

function markInstagramLinkClicked() {
  if (state.instagramLinkClicked) return;
  state.instagramLinkClicked = true;
  if (dom.feedbackBanner.dataset.kind === 'pending') clearFeedback();
  updateGating();
  progress.save();
}

function markReviewLinkClicked() {
  if (state.reviewLinkClicked) return;
  state.reviewLinkClicked = true;
  if (dom.feedbackBanner.dataset.kind === 'pending') clearFeedback();
  updateGating();
  progress.save();
}

// Persiste nome e telefone digitados sem disparar resgate
function saveNameProgress() {
  state.customerName = dom.inputName.value;
  progress.save();
}

// Persiste telefone digitado sem disparar resgate
function savePhoneProgress() {
  state.phoneNumber = dom.inputPhone.value;
  progress.save();
}

// Configuração dos Event Listeners
function setupEventListeners() {
  document.getElementById('btn-welcome').addEventListener('click', () => goToStep(1));
  document.getElementById('form-step-1').addEventListener('submit', e => { e.preventDefault(); handleValidateInstagram(); });
  document.getElementById('form-step-3').addEventListener('submit', e => { e.preventDefault(); handleClaimGift(); });

  // O prefixo @ já aparece dentro do campo: tira o @ digitado ou colado para não duplicar
  dom.inputIg.addEventListener('input', () => {
    const v = dom.inputIg.value.replace(/^@+/, '');
    if (v !== dom.inputIg.value) dom.inputIg.value = v;
    updateGating();
  });

  // Links externos: registra clique real antes de habilitar continuar
  if (dom.btnOpenIg) dom.btnOpenIg.addEventListener('click', markInstagramLinkClicked);
  if (dom.btnOpenReview) dom.btnOpenReview.addEventListener('click', markReviewLinkClicked);

  // Passo 2: Confirmação da Avaliação (transição de agradecimento 3,5s)
  dom.btnConfirmReview.addEventListener('click', handleConfirmReview);

  // Passo 3: nome e telefone digitados (salva progresso opcional)
  dom.inputName.addEventListener('input', saveNameProgress);
  dom.inputPhone.addEventListener('input', savePhoneProgress);

  // Passos 4 e 5: copiar o cupom (há um botão em cada passo)
  document.querySelectorAll('[data-copy-coupon]').forEach(button => {
    button.addEventListener('click', () => handleCopyCoupon(button));
  });

  // Passo 4: Fallback de Revelação Acessível
  dom.btnFallbackReveal.addEventListener('click', () => {
    revealedByButton = true;
    if (scratchInstance) scratchInstance.reveal();
    dom.btnFallbackReveal.classList.add('hidden');
  });

  // Passo 4 → 5 (como usar) e volta ao cupom
  dom.btnHowToUse.addEventListener('click', () => goToStep(5));
  dom.btnBackToCode.addEventListener('click', () => goToStep(4));
}

// Atualização de Progresso Visual e Acessibilidade
function updateProgress(percent) {
  dom.progressFill.style.transform = `scaleX(${percent / 100})`;
  dom.progressBarContainer.setAttribute('aria-valuenow', percent);
  dom.progressNumber.textContent = `${percent}%`;
  dom.progressLabel.textContent = percent === 100 ? 'Presente liberado! ♡' : `Passo ${state.step} de 3`;
}

// Exibição de Feedback
function showFeedback(message, type = 'info') {
  delete dom.feedbackBanner.dataset.kind;
  dom.feedbackBanner.textContent = message;
  dom.feedbackBanner.className = `feedback-banner ${type}`;
  dom.feedbackBanner.classList.remove('hidden');
  dom.feedbackBanner.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
}

function clearFeedback() {
  delete dom.feedbackBanner.dataset.kind;
  dom.feedbackBanner.classList.add('hidden');
  dom.feedbackBanner.textContent = '';
}

function announceFeedback(msg, type) {
  showFeedback(msg, type);
}

// Passo 1: @ declarado pelo cliente, sem consulta ao Instagram.
function handleValidateInstagram() {
  if (!state.instagramLinkClicked) {
    showFeedback('Antes de continuar, toque em “Abrir perfil no Instagram”. Depois é só voltar aqui.', 'info');
    dom.feedbackBanner.dataset.kind = 'pending';
    nudgeLink(dom.btnOpenIg);
    return;
  }
  const rawIg = dom.inputIg.value.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(rawIg)) {
    showFeedback('Digite um @ válido do Instagram (letras, números, ponto ou sublinhado).', 'error');
    dom.inputIg.focus();
    return;
  }
  state.handleIg = rawIg;
  goToStep(2);
}

// --- Transição de Agradecimento (3,5s) com coração crescendo e explodindo ---
const THANK_YOU_MS = 4400;          // coração cresce ~2,7 s, estoura em brilhos e a cena fecha
const THANK_YOU_REDUCED_MS = 1800;  // prefers-reduced-motion: coração parado, sem brilhos
const SPARK_COUNT = 58;
const SKIP_AFTER_MS = 700;          // evita toque acidental logo na abertura
let gratitudeTimer = null;
let gratitudeOpenedAt = 0;

// Brilhos dourados de 4 pontas (#sparkle), lançados do centro do coração no instante da explosão.
function buildSparkles() {
  const stage = dom.gratitudeStage;
  stage.querySelectorAll('.spark').forEach(n => n.remove());
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const NS = 'http://www.w3.org/2000/svg';
  const reach = Math.min(Math.max(innerWidth, 320) * 0.55, 440);
  for (let i = 0; i < SPARK_COUNT; i++) {
    const angle = (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = reach * (0.3 + Math.random() * 0.7);
    const el = document.createElementNS(NS, 'svg');
    el.setAttribute('class', 'spark');
    el.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#sparkle');
    el.appendChild(use);
    el.style.setProperty('--s', (i % 5 === 0 ? 34 + Math.random() * 24 : 13 + Math.random() * 18).toFixed(1) + 'px');
    el.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
    el.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(1) + 'px');
    el.style.setProperty('--rot', ((Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 140)).toFixed(0) + 'deg');
    el.style.setProperty('--dur', (1.0 + Math.random() * 0.35).toFixed(2) + 's');
    el.style.setProperty('--delay', (Math.random() * 0.14).toFixed(2) + 's');
    stage.appendChild(el);
  }
}

// Encerra a cena (timer, toque, Esc ou botão) e segue para o passo 3
function finishGratitude() {
  if (gratitudeTimer === null) return;
  clearTimeout(gratitudeTimer);
  gratitudeTimer = null;
  dom.gratitudeScene.close();
  document.body.style.overflow = '';
  goToStep(3);
}

// Handler: Passo 2 — Confirmação da Avaliação
function handleConfirmReview() {
  if (!state.reviewLinkClicked) {
    showFeedback('Antes de continuar, toque em “Abrir Pedidos10” e conte como foi seu pedido. Depois é só voltar aqui.', 'info');
    dom.feedbackBanner.dataset.kind = 'pending';
    nudgeLink(dom.btnOpenReview);
    return;
  }
  if (gratitudeTimer !== null) return; // bloqueia cliques múltiplos durante a transição
  state.reviewDeclared = true;
  dom.btnConfirmReview.disabled = true;
  dom.btnConfirmReview.setAttribute('aria-disabled', 'true');

  // Persiste já no Passo 3: refresh durante a cena retoma coerente (sem prometer cupom)
  state.step = 3;
  updateProgress(66);
  progress.save();

  const dialog = dom.gratitudeScene;
  buildSparkles();
  dialog.showModal();
  gratitudeOpenedAt = Date.now();
  document.body.style.overflow = 'hidden';
  dom.gratitudeTitle.focus();
  dialog.oncancel = event => { event.preventDefault(); finishGratitude(); };
  dialog.onclick = event => {
    if (event.target.id === 'gratitude-skip' || Date.now() - gratitudeOpenedAt > SKIP_AFTER_MS) finishGratitude();
  };
  gratitudeTimer = setTimeout(finishGratitude, matchMedia('(prefers-reduced-motion: reduce)').matches ? THANK_YOU_REDUCED_MS : THANK_YOU_MS);
}

// --- Dados do cupom na tela ---
// O desconto vem do cupom ("10%") e o pedido mínimo como decimal ("50.00"). Valor ausente ou fora do
// formato some da tela, em vez de mostrar um texto estranho.
function formatDiscount(raw) {
  const match = /^(\d+(?:[.,]\d+)?)\s*%$/.exec(String(raw ?? '').trim());
  return match ? `${match[1].replace('.', ',')}%` : '';
}

// Devolve o valor em reais, 0 (sem mínimo) ou null (ausente ou fora do formato)
function formatMinOrder(raw) {
  const text = String(raw ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  return value === 0 ? 0 : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDatePt(iso) {
  if (typeof iso !== 'string') return '';
  const parts = iso.trim().split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : '';
}

// Preenche o cartão do passo 4 e as instruções do passo 5 com o cupom recebido.
let couponView = { usable: true };
function renderCoupon(data) {
  const code = (data.couponCode || data.code || '').trim();
  const validade = formatDatePt(data.validade);
  let availText = 'Disponível';
  if (data.vencido) {
    availText = 'Vencido';
  } else if (data.disponivel === false) {
    availText = 'Indisponível no momento';
  }
  const desconto = formatDiscount(data.desconto);
  const minOrder = formatMinOrder(data.pedidoMinimo);
  couponView = { code, validade, desconto, minOrder, usable: availText === 'Disponível' };
  state.couponCode = code;

  // Passo 4: cartão e textos de antes de raspar
  dom.step4Title.textContent = 'Um carinho para seu próximo pedido.';
  dom.step4Intro.textContent = desconto
    ? 'Raspe com o dedo para descobrir seu desconto. Também pode usar o botão abaixo.'
    : 'Raspe com o dedo para revelar seu cupom. Também pode usar o botão abaixo.';
  dom.revealedCouponCode.textContent = code;
  dom.couponDiscount.textContent = desconto ? `${desconto} de desconto` : '';
  dom.couponDiscount.hidden = !desconto;
  dom.couponMinItem.hidden = minOrder === null;
  dom.couponMinOrder.textContent = minOrder === 0 ? 'Sem mínimo' : (minOrder || '');
  if (dom.couponValidity) dom.couponValidity.textContent = validade;
  if (dom.couponAvailability) dom.couponAvailability.textContent = availText;
  dom.btnHowToUse.hidden = true;
  dom.btnOrderDirect.hidden = true;

  // Passo 5: instruções e condições
  dom.howtoCode.textContent = code;
  dom.howtoLead.textContent = desconto
    ? `Seu código vale ${desconto} de desconto no Pedidos10.`
    : 'Seu código vale no seu próximo pedido no Pedidos10.';
  dom.howtoMin.hidden = minOrder === null;
  dom.howtoMin.textContent = minOrder === 0 ? 'Sem pedido mínimo.' : `Pedido mínimo de ${minOrder}.`;
  dom.howtoValidity.hidden = !validade;
  dom.howtoValidity.textContent = `Válido até ${validade}.`;
}

// Depois de raspar: o cartão passa a explicar o que o código é e a próxima ação aparece à vista.
function showRevealed() {
  const view = couponView;
  clearFeedback();
  dom.btnFallbackReveal.classList.add('hidden');
  if (view.usable) {
    dom.step4Title.textContent = 'Seu presente chegou!';
    dom.step4Intro.textContent = 'Este código é o seu cupom para o próximo pedido no Pedidos10. Copie e veja como usar.';
    dom.btnHowToUse.hidden = false;
    dom.copyStatus.textContent = `${view.desconto ? `Você ganhou ${view.desconto} de desconto. ` : ''}Seu cupom está pronto.`;
  } else {
    // Cliente que já tinha recebido: vê o cupom, mas sem promessa de uso se venceu ou foi desligado
    dom.step4Title.textContent = 'Aqui está o cupom que você recebeu.';
    dom.step4Intro.textContent = 'Ele não está mais disponível para uso.';
    dom.btnOrderDirect.hidden = false;
    dom.copyStatus.textContent = 'Este cupom não está mais disponível para uso.';
  }
  if (revealedByButton) (view.usable ? dom.btnHowToUse : dom.btnOrderDirect).focus({ preventScroll: true });
}

// --- Tela de espera (fatia de bolo) enquanto o n8n responde ---
const LOADING_DELAY_MS = 300;       // resposta rápida nem chega a mostrar a tela de espera
const LOADING_MIN_VISIBLE_MS = 800; // e, mostrada, ela não pisca de volta
const LOADING_SLOW_MS = 15000;
const LOADING_NOTE = 'Estamos separando uma fatia de carinho para você.';
const LOADING_NOTE_SLOW = 'Está demorando um pouquinho mais que o normal. Continue por aqui.';

function startLoadingScene() {
  let shownAt = 0;
  let slowTimer = null;
  const delayTimer = setTimeout(() => {
    shownAt = Date.now();
    dom.loadingNote.textContent = LOADING_NOTE;
    showScene('step-loading');
    slowTimer = setTimeout(() => { dom.loadingNote.textContent = LOADING_NOTE_SLOW; }, LOADING_SLOW_MS);
  }, LOADING_DELAY_MS);
  return {
    // Devolve true se a tela de espera chegou a aparecer (quem chama precisa voltar ao formulário)
    async finish() {
      clearTimeout(delayTimer);
      clearTimeout(slowTimer);
      if (!shownAt) return false;
      const wait = LOADING_MIN_VISIBLE_MS - (Date.now() - shownAt);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      return true;
    }
  };
}

// Handler: Passo 3 — Resgate do Cupom
async function handleClaimGift() {
  if (state.isSubmitting) return;

  const customerName = dom.inputName.value.trim();
  if (!customerName || customerName.length < 2) {
    showFeedback('Por favor, informe seu nome antes de resgatar.', 'error');
    dom.inputName.focus();
    return;
  }
  if (customerName.length > 80) {
    showFeedback('O nome deve ter no máximo 80 caracteres.', 'error');
    dom.inputName.focus();
    return;
  }
  state.customerName = customerName;

  const normalizedPhone = normalizePhoneToE164(dom.inputPhone.value.trim());
  if (!normalizedPhone) {
    showFeedback('Por favor, informe um celular válido com DDD (ex: 41 99999-9999).', 'error');
    dom.inputPhone.focus();
    return;
  }
  if (!state.handleIg || !state.reviewDeclared) {
    showFeedback('Complete os passos anteriores antes do resgate.', 'error');
    return;
  }
  if (!state.instagramLinkClicked || !state.reviewLinkClicked) {
    showFeedback('Complete os passos anteriores antes do resgate.', 'error');
    return;
  }
  state.phoneNumber = normalizedPhone;

  clearFeedback();
  setButtonLoading(dom.btnClaimGift, true);
  state.isSubmitting = true;

  const loading = startLoadingScene();
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  // outcome: { ok: true, data } ou { message, type } para o aviso do formulário
  let outcome;
  try {
    const payload = {
      campaignId: CONFIG.campaignId,
      handleIg: state.handleIg,
      name: state.customerName,
      phoneNumber: state.phoneNumber,
      reviewDeclared: state.reviewDeclared
    };

    const res = await fetch(CONFIG.webhookResgatarPresente, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    });

    const data = await res.json().catch(() => ({}));
    const couponCode = (data.couponCode || data.code || '').trim();

    if (res.status === 200 && couponCode) {
      outcome = {
        ok: true,
        data,
        notice: data.status === 'pendente'
          ? 'Seu cupom está disponível acima, mas o WhatsApp não confirmou o envio. Tente novamente em instantes.'
          : null
      };
    } else if (res.status === 202) {
      outcome = { message: 'Seu resgate ainda está sendo processado. Aguarde alguns instantes e tente novamente.', type: 'info' };
    } else if (res.status === 409 && data.status === 'em_processamento') {
      outcome = { message: 'Seu resgate já está sendo processado. Aguarde alguns instantes.', type: 'info' };
    } else if (res.status === 409 && data.status === 'cupom_vencido') {
      outcome = { message: 'Este cupom expirou e não pode ser resgatado.', type: 'info' };
    } else if (res.status === 409) {
      outcome = { message: 'Os cupons desta rodada esgotaram. Obrigado pelo carinho com a Goostozinhos! Nosso cardápio continua esperando por você.', type: 'info' };
    } else if (res.status === 503 && data.status === 'erro_temporario') {
      outcome = { message: 'Estamos com uma falha temporária. Tente novamente em instantes.', type: 'error' };
    } else {
      outcome = { message: 'Não foi possível concluir o resgate agora. Tente novamente em instantes.', type: 'error' };
    }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      outcome = { message: 'A conexão está demorando mais que o normal e não conseguimos confirmar o envio agora — mas fique tranquilo: mesmo que esta tela não mostre nada, o presente continua sendo enviado para o seu WhatsApp. Se não chegar em alguns minutos, tente novamente.', type: 'error' };
    } else {
      outcome = { message: 'Conexão interrompida. Não foi possível confirmar o resgate. Tente novamente quando sua conexão voltar.', type: 'error' };
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const wasShown = await loading.finish();
  try {
    if (outcome.ok) {
      renderCoupon(outcome.data);
      goToStep(4);
      initScratchCard();
      if (outcome.data.status === 'ja_resgatado') {
        showFeedback('Você já resgatou seu presente nesta campanha. Aqui está seu cupom.', 'info');
      } else if (outcome.notice) {
        showFeedback(outcome.notice, 'info');
      } else {
        showFeedback(`Presente liberado! Raspe para descobrir seu ${couponView.desconto ? 'desconto' : 'código'}.`, 'success');
      }
    } else {
      if (wasShown) showScene('step-3'); // volta ao formulário, com os dados preenchidos
      showFeedback(outcome.message, outcome.type);
    }
  } catch (err) {
    if (wasShown) showScene('step-3');
    showFeedback('Não foi possível concluir o resgate agora. Tente novamente em instantes.', 'error');
  } finally {
    setButtonLoading(dom.btnClaimGift, false);
    state.isSubmitting = false;
  }
}

// Inicializa a Raspadinha
function initScratchCard() {
  if (scratchInstance) return;

  scratchInstance = new window.ScratchCard('scratch-canvas', {
    threshold: 40,
    brushRadius: 26,
    onRevealed: showRevealed
  });
}

// Copiar Cupom. A área de transferência moderna só existe em HTTPS ou localhost: sem ela usa a
// cópia antiga e, em último caso, deixa o código selecionado para copiar pelo menu do aparelho.
async function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) { /* tenta o caminho antigo */ }
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);
  let copied = false;
  try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
  field.remove();
  return copied;
}

function selectCouponText(target) {
  const range = document.createRange();
  range.selectNodeContents(target);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

// Os dois botões de copiar (passos 4 e 5) mudam juntos
function setCopyState(label, copied) {
  document.querySelectorAll('[data-copy-coupon]').forEach(button => {
    button.classList.toggle('is-copied', copied);
    const text = button.querySelector('.btn-label');
    if (text) text.textContent = label;
  });
}

let copyResetTimer = null;
async function handleCopyCoupon(button) {
  const code = state.couponCode || dom.revealedCouponCode.textContent;
  if (!code) return;

  const copied = await copyText(code);
  clearTimeout(copyResetTimer);
  if (copied) {
    setCopyState('Código copiado', true);
    dom.copyStatus.textContent = 'Código copiado.';
  } else {
    selectCouponText(button && button.closest('#step-5') ? dom.howtoCode : dom.revealedCouponCode);
    setCopyState('Código selecionado', false);
    showFeedback('Não conseguimos copiar sozinhos. O código ficou selecionado: use “Copiar” no menu do seu aparelho.', 'info');
  }
  copyResetTimer = setTimeout(() => {
    setCopyState('Copiar código', false);
    dom.copyStatus.textContent = '';
  }, 2500);
}

// Navegação entre Passos
function showScene(id) {
  for (const scene of document.querySelectorAll('.scene')) scene.classList.toggle('hidden', scene.id !== id);
  clearFeedback();
  const heading = document.getElementById(id).querySelector('h1, h2');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function goToStep(nextStep) {
  state.step = nextStep;
  dom.progressSection.classList.remove('hidden');
  showScene(`step-${nextStep}`);
  updateProgress(PROGRESS_BY_STEP[nextStep] ?? 0);
  progress.save();
}

// Helper: Loading de botões
function setButtonLoading(btn, isLoading) {
  const spinner = btn.querySelector('.btn-spinner');
  const text = btn.querySelector('.btn-text');
  
  if (isLoading) {
    btn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (text) text.style.opacity = '0.6';
  } else {
    btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (text) text.style.opacity = '1';
  }
}
