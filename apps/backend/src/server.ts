import { app } from "./app.js";
import { env } from "./config/env.js";
import { ordersService } from "./modules/orders/orders.service.js";

const expireOrders = () => {
  void ordersService.expirePendingOrders().catch((error: unknown) => {
    console.error("Could not release expired mock order reservations", error);
  });
};

expireOrders();
const expiryTimer = setInterval(expireOrders, 30_000);
expiryTimer.unref();
app.listen(env.port, () => {
  console.info(`API listening on http://localhost:${env.port}`);
});
