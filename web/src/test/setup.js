import { config } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';

// Register PrimeVue globally for all tests
config.global.plugins = [
  [PrimeVue, { ripple: false }],
  ConfirmationService,
  ToastService,
];

// Stub the Tooltip directive so tests don't break
config.global.directives = {
  tooltip: {},
};

// Attach to document.body so portals (Dialog, Toast) render correctly
config.global.stubs = {};
