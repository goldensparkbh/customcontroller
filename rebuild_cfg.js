const fs = require('fs');

const lines = fs.readFileSync('conf_1.txt', 'utf8').split('\n');
const markup = lines.slice(4, 201).join('\n');

const template = `import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const configuratorMarkup = \`
${markup}
\`;

const ConfiguratorPage = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFirebaseData = async () => {
      try {
        const partsSnap = await getDocs(collection(db, 'configurator_parts'));
        const partsList = partsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        for (const part of partsList) {
          const optSnap = await getDocs(collection(db, \`configurator_parts/\${part.id}/options\`));
          part.options = optSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        window.__CONFIG_FIREBASE_DATA__ = partsList;
      } catch (err) {
        console.error('Firebase fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFirebaseData();
  }, []);

  useEffect(() => {
    if (loading) return;
    document.body.classList.add('configurator-page-active');
    const script = document.createElement('script');
    script.src = '/configurator-logic.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.classList.remove('configurator-page-active');
      if (document.body.contains(script)) {
         // Optionally remove the script
      }
    };
  }, [loading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0b0b0f', color: '#fff' }}>
        <h2 style={{ marginLeft: '1rem' }}>Loading Configurator...</h2>
      </div>
    );
  }

  return (
    <div className="configurator-page">
      <div dangerouslySetInnerHTML={{ __html: configuratorMarkup }} />
    </div>
  );
};

export default ConfiguratorPage;
`;

fs.writeFileSync('src/pages/Configurator.jsx', template);
console.log('Restored Configurator.jsx DOM + Firebase injected!');
