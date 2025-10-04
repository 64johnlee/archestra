import config from "@config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schemas";

const db = drizzle({
  connection: {
    connectionString: config.database.url,
  },
});

export default db;
export { schema };
