const cp = require('child_process');

try {
    cp.execSync('git restore src/pages/Configurator.jsx public/configurator-logic.js src/pages/Cart.jsx src/pages/Checkout.jsx src/index.css src/App.jsx');
    console.log("Successfully restored git index files in working tree.");
} catch (e) {
    console.error("Error", e);
}
