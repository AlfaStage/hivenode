import crypto from "crypto";
import bcryptjs from "bcryptjs";

// Pegamos a chave e derivamos com scryptSync para garantir 32 bytes (AES-256)
function encryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error("ENCRYPTION_KEY must contain at least 32 characters");
  return crypto.scryptSync(key, "hivenode-salt", 32);
}
const ALGORITHM = "aes-256-gcm";

export function encrypt(text: string): string {
	const iv = crypto.randomBytes(16);
 const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
	
	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	
	const authTag = cipher.getAuthTag().toString("hex");
	
	// Retornamos iv:authTag:encrypted
	return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(payload: string): string {
	try {
		const parts = payload.split(":");
		if (parts.length !== 3) {
			throw new Error("Invalid payload format");
		}
		
		const iv = Buffer.from(parts[0], "hex");
		const authTag = Buffer.from(parts[1], "hex");
		const encrypted = parts[2];
		
 const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), iv);
		decipher.setAuthTag(authTag);
		
		let decrypted = decipher.update(encrypted, "hex", "utf8");
		decrypted += decipher.final("utf8");
		
		return decrypted;
	} catch (e) {
		console.error("Falha ao descriptografar dado:", e);
		return "";
	}
}

export async function bcryptHash(text: string): Promise<string> {
	return await bcryptjs.hash(text, 12);
}

export async function bcryptCompare(text: string, hash: string): Promise<boolean> {
	return await bcryptjs.compare(text, hash);
}
