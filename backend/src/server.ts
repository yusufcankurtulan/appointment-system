import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
});
