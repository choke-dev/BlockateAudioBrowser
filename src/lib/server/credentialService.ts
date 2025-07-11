import { sql } from "drizzle-orm";
import { db } from "./db";

type Credential = {
    /*
     * The account to upload the audio to
     */
    ownerId: number;
    /*
     * The API key for reading from the library
     */
    apiKey: string;
}

export const getAvailableCredentials = async (): Promise<Credential[]> => {
    const credentials: { decrypted_secret: string }[] = await db.execute(
        sql`select decrypted_secret from vault.decrypted_secrets;`
    );
    return credentials.map((credential: any) => JSON.parse(credential.decrypted_secret));
}