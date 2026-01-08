const app = require('./app');
const port = process.env.PORT || 8000;


app.listen(port, () => {
  console.log(`Resume generator server running at http://localhost:${port}`);
});
