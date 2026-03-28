// LoadPro — Utilitários

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Escape HTML (anti-XSS) — usar em TODA interpolação de dado do usuário
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// Toast notifications
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle' };
  toast.innerHTML = `<i data-lucide="${icons[type] || icons.success}" style="width:18px;height:18px;flex-shrink:0"></i> ${msg}`;
  container.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// Formatar data
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

// Formatar data e hora
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('pt-BR');
}

// Tempo relativo
function timeAgo(dateStr) {
  if (!dateStr) return 'nunca';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'ontem';
  if (days < 7) return `${days} dias atrás`;
  return formatDate(dateStr.split('T')[0]);
}

// Calcular idade
function calcIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento + 'T00:00:00');
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

// Calcular IMC
function calcIMC(pesoKg, alturaCm) {
  if (!pesoKg || !alturaCm) return null;
  const alturaM = alturaCm / 100;
  return +(pesoKg / (alturaM * alturaM)).toFixed(1);
}

function classificarIMC(imc) {
  if (!imc) return '';
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25) return 'Normal';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade I';
  if (imc < 40) return 'Obesidade II';
  return 'Obesidade III';
}

// Calcular TMB (Mifflin-St Jeor)
function calcTMB(pesoKg, alturaCm, idade, sexo) {
  const base = (10 * pesoKg) + (6.25 * alturaCm) - (5 * idade);
  return sexo === 'masculino' ? base + 5 : base - 161;
}

// Calcular macros
function calcMacros(metaKcal, pesoKg) {
  const proteinaG = +(pesoKg * 2).toFixed(0);
  const proteinaKcal = proteinaG * 4;
  const gorduraKcal = metaKcal * 0.25;
  const gorduraG = +(gorduraKcal / 9).toFixed(0);
  const carboKcal = metaKcal - proteinaKcal - gorduraKcal;
  const carboG = +(carboKcal / 4).toFixed(0);
  return { proteinaG, gorduraG, carboG };
}

// Gerar initials de avatar
function getInitials(nome) {
  return (nome || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// Máscara telefone
function maskPhone(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 6) v = `(${v.substring(0,2)}) ${v.substring(2,7)}-${v.substring(7)}`;
    else if (v.length > 2) v = `(${v.substring(0,2)}) ${v.substring(2)}`;
    input.value = v;
  });
}

// Debounce
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Abrir/fechar modal
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// ESC fecha qualquer modal aberto
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var modal = document.querySelector('.modal-overlay.active');
    if (modal) { modal.classList.remove('active'); e.preventDefault(); }
    // Fechar bottom sheet também
    var sheet = document.getElementById('bottomSheet');
    if (sheet && sheet.classList.contains('open')) { sheet.classList.remove('open'); document.body.style.overflow = ''; }
  }
});

// Dias da semana
const DIAS_SEMANA = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

// Grupos musculares
const GRUPOS_MUSCULARES = [
  'Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Antebraço',
  'Quadríceps', 'Posterior de Coxa', 'Glúteos', 'Panturrilha',
  'Abdômen', 'Trapézio', 'Lombar'
];

// Equipamentos
const EQUIPAMENTOS = [
  'Barra', 'Halter', 'Máquina', 'Cabo', 'Peso Corporal', 'Kettlebell', 'Elástico', 'Smith', 'Outro'
];
