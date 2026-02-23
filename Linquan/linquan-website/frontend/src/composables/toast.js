import { reactive } from 'vue';

const toastState = reactive({
  visible: false,
  text: '',
  type: 'info'
});

let hideTimer = null;

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function hideToast() {
  clearHideTimer();
  toastState.visible = false;
}

function showToast(text, type = 'info', duration = 2400) {
  const content = String(text || '').trim();
  if (!content) {
    return;
  }
  clearHideTimer();
  toastState.text = content;
  toastState.type = type;
  toastState.visible = true;
  hideTimer = setTimeout(() => {
    toastState.visible = false;
    hideTimer = null;
  }, duration);
}

function showSuccess(text, duration = 2200) {
  showToast(text, 'success', duration);
}

function showError(err, fallback = '') {
  const text =
    typeof err === 'string'
      ? err
      : err?.response?.data?.message || (fallback ? String(fallback) : '');
  showToast(text, 'error', 2800);
}

export function useToast() {
  return {
    toastState,
    showToast,
    showSuccess,
    showError,
    hideToast
  };
}
