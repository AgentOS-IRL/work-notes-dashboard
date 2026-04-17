const express = require('express');
const app = express();
const path = require('path');
app.get('/', (req, res) => {
  const p = path.resolve(__dirname, 'frontend/.output/public/index.html');
  res.sendFile(p, { dotfiles: 'allow' }, (err) => {
    if (err) console.error("Error from sendFile:", err.message);
  });
});
app.listen(3001, () => {
  console.log("Listening on 3001");
});
