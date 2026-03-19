import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import 'primeicons/primeicons.css';
import App from './App.vue';
import './assets/styles.css';

// Custom palette: #880d1e, #dd2d4a, #f26a8d, #f49cbb, #cbeef3
const CLIkanbanPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fef1f3',
      100: '#fde6ea',
      200: '#f9b8c5',
      300: '#f49cbb',
      400: '#f26a8d',
      500: '#dd2d4a',
      600: '#c42843',
      700: '#a1213a',
      800: '#880d1e',
      900: '#6b0a18',
      950: '#4a0711',
    },
    colorScheme: {
      light: {
        primary: {
          color: '#dd2d4a',
          contrastColor: '#ffffff',
          hoverColor: '#c42843',
          activeColor: '#a1213a',
        },
        highlight: {
          background: '#fef1f3',
          focusBackground: '#fde6ea',
          color: '#880d1e',
          focusColor: '#880d1e',
        },
      },
      dark: {
        primary: {
          color: '#f26a8d',
          contrastColor: '#1a1a2e',
          hoverColor: '#f49cbb',
          activeColor: '#dd2d4a',
        },
        highlight: {
          background: 'rgba(242, 106, 141, 0.16)',
          focusBackground: 'rgba(242, 106, 141, 0.24)',
          color: 'rgba(255,255,255,.87)',
          focusColor: 'rgba(255,255,255,.87)',
        },
      },
    },
  },
});

const app = createApp(App);

app.use(PrimeVue, {
  theme: {
    preset: CLIkanbanPreset,
    options: {
      darkModeSelector: '.dark-mode',
      cssLayer: false,
    },
  },
  ripple: true,
});

app.use(ConfirmationService);
app.use(ToastService);
app.directive('tooltip', Tooltip);

app.mount('#app');
