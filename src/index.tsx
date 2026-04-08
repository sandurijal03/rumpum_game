import * as React from 'react';
import { createRoot } from 'react-dom/client';

import Main from './Main';

createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
);
