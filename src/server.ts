import { app } from "./app";
import { config } from "dotenv";


// Load environment variables
config();



const port = process.env.PORT || 3000;

const start = async () => {
  try {
    await app.listen({ port: Number(port), host: "0.0.0.0" });

    const address = app.server.address();
    const currentPort = typeof address === "string" ? address : address?.port;

    app.log.info(`Server listening on port ${currentPort}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
