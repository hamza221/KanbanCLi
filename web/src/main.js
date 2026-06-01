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

// Design palette adapted from the board mock.
const CLIkanbanPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f2f3ff',
      100: '#e8eaff',
      200: '#d6d9ff',
      300: '#b8bef8',
      400: '#8d96ea',
      500: '#5e6ad2',
      600: '#515abb',
      700: '#434a9a',
      800: '#383e7d',
      900: '#303565',
      950: '#1f2242',
    },
    colorScheme: {
      light: {
        primary: {
          color: '#5e6ad2',
          contrastColor: '#ffffff',
          hoverColor: '#515abb',
          activeColor: '#434a9a',
        },
        highlight: {
          background: '#f2f3ff',
          focusBackground: '#e8eaff',
          color: '#303565',
          focusColor: '#303565',
        },
      },
      dark: {
        primary: {
          color: '#8d96ea',
          contrastColor: '#ffffff',
          hoverColor: '#b8bef8',
          activeColor: '#5e6ad2',
        },
        highlight: {
          background: 'rgba(94, 106, 210, 0.16)',
          focusBackground: 'rgba(94, 106, 210, 0.24)',
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
